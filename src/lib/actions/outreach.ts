"use server";

import { revalidatePath } from "next/cache";
import { isBlocked, isSuppressed } from "../domain/filters";
import { canSend, isPending } from "../domain/outreach";
import { integrations } from "../integrations";
import { outreachKindLabel } from "../labels";
import { getStore } from "../store";
import { DAILY_LIMITS, type Lead, type OutreachItem, type OutreachKind } from "../types";

const KINDS = Object.keys(DAILY_LIMITS) as OutreachKind[];

function isKind(value: unknown): value is OutreachKind {
  return typeof value === "string" && (KINDS as string[]).includes(value);
}

/** Load a lead and check that it may be contacted at all. */
async function contactableLead(
  leadId: string,
): Promise<{ ok: true; lead: Lead } | { ok: false; error: string }> {
  const store = await getStore();
  const [lead, blockList, removals] = await Promise.all([
    store.getLead(leadId),
    store.listBlockList(),
    store.listRemovalRequests(),
  ]);
  if (!lead) return { ok: false, error: "Personen finns inte längre." };
  if (isBlocked(lead, blockList) || isSuppressed(lead.profileUrl, removals)) {
    return { ok: false, error: "Personen finns på spärrlistan och kan inte kontaktas." };
  }
  if (lead.outcome === "not_a_fit") return { ok: false, error: "Personen är markerad som inte relevant." };
  return { ok: true, lead };
}

/** Create a draft for a lead using the AI provider. */
export async function draftOutreach(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const kind = formData.get("kind");
  if (!leadId || !isKind(kind)) return;

  const checked = await contactableLead(leadId);
  if (!checked.ok) return;

  const store = await getStore();
  const workspace = await store.getWorkspace();
  const body = await integrations.ai.draftMessage(workspace, checked.lead, kind);
  await store.addOutreach({
    id: `out_${crypto.randomUUID()}`,
    leadId,
    kind,
    body,
    status: "ready",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/", "layout");
}

export type OutreachActionState = { error?: string; message?: string };

/**
 * One entry point for the queue card so each card can show its own result.
 * `intent` is one of save, approve, cancel or send.
 */
export async function outreachAction(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const store = await getStore();
  const item = await store.getOutreach(id);
  if (!item) return { error: "Utskicket finns inte längre." };
  if (!isPending(item)) return { error: "Utskicket är redan skickat eller avbrutet." };

  let result: OutreachActionState;
  switch (intent) {
    case "save":
      result = await saveBody(item, String(formData.get("body") ?? ""));
      break;
    case "approve":
      result = await approve(item, String(formData.get("body") ?? item.body));
      break;
    case "cancel":
      await store.saveOutreach([{ ...item, status: "cancelled", cancelReason: "Avbruten manuellt" }]);
      result = { message: "Utskicket är avbrutet." };
      break;
    case "send":
      result = await send(item);
      break;
    default:
      result = { error: "Okänd åtgärd." };
  }
  revalidatePath("/", "layout");
  return result;
}

async function saveBody(item: OutreachItem, body: string): Promise<OutreachActionState> {
  const text = body.trim();
  if (!text) return { error: "Texten får inte vara tom." };
  if (text === item.body) return { message: "Inga ändringar." };
  const store = await getStore();
  // Edited text has to be approved again before it can be sent.
  await store.saveOutreach([{ ...item, body: text, status: "ready" }]);
  return { message: item.status === "approved" ? "Sparat. Godkänn igen innan det skickas." : "Sparat." };
}

async function approve(item: OutreachItem, body: string): Promise<OutreachActionState> {
  const text = body.trim();
  if (!text) return { error: "Texten får inte vara tom." };
  const checked = await contactableLead(item.leadId);
  if (!checked.ok) return { error: checked.error };
  const store = await getStore();
  await store.saveOutreach([{ ...item, body: text, status: "approved" }]);
  return { message: "Godkänt." };
}

async function send(item: OutreachItem): Promise<OutreachActionState> {
  if (item.status !== "approved") return { error: "Godkänn utskicket innan det skickas." };

  const checked = await contactableLead(item.leadId);
  if (!checked.ok) {
    const store = await getStore();
    await store.saveOutreach([{ ...item, status: "cancelled", cancelReason: checked.error }]);
    return { error: `${checked.error} Utskicket är avbrutet.` };
  }

  const store = await getStore();
  const all = await store.listOutreach();
  const now = new Date();
  if (!canSend(all, item.kind, now)) {
    return {
      error: `Dagens gräns för ${outreachKindLabel[item.kind].toLowerCase()} är nådd (${DAILY_LIMITS[item.kind]} per dag). Försök igen i morgon.`,
    };
  }

  const response = await integrations.linkedin.send(item, checked.lead);
  if (!response.ok) return { error: response.error ?? "Det gick inte att skicka. Försök igen senare." };

  await store.saveOutreach([{ ...item, status: "sent", sentAt: now.toISOString() }]);
  return { message: "Skickat." };
}
