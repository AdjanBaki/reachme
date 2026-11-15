"use server";

import { revalidatePath } from "next/cache";
import { isBlocked, isSuppressed } from "../domain/filters";
import { isPending } from "../domain/outreach";
import { checkSend, nextGapMs, sendingSettings } from "../domain/pacing";
import { integrations } from "../integrations";
import { userMessageFor } from "../integrations/errors";
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

export type OutreachActionState = { error?: string; message?: string };

/** Create a draft for a lead using the AI provider. */
export async function draftOutreach(_prev: OutreachActionState, formData: FormData): Promise<OutreachActionState> {
  const leadId = String(formData.get("leadId") ?? "");
  const kind = formData.get("kind");
  if (!leadId || !isKind(kind)) return { error: "Okänd typ av utskick." };

  const checked = await contactableLead(leadId);
  if (!checked.ok) return { error: checked.error };

  const store = await getStore();
  const workspace = await store.getWorkspace();
  let body: string;
  try {
    body = await integrations.ai.draftMessage(workspace, checked.lead, kind);
  } catch (error) {
    return { error: userMessageFor(error, "Kunde inte skriva ett utkast. Försök igen.") };
  }
  await store.addOutreach({
    id: `out_${crypto.randomUUID()}`,
    leadId,
    kind,
    body,
    status: "ready",
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/", "layout");
  return { message: "Utkastet finns i Redo att skicka." };
}

/**
 * One entry point for the queue card so each card can show its own result.
 * `intent` is one of save, approve, cancel, send (automated) or mark_sent (manual).
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
      result = await send(item, true);
      break;
    case "mark_sent":
      result = await send(item, false);
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

/**
 * Send an approved item. With `viaProvider` the LinkedIn provider sends it
 * (automated mode, paced). Without it the user has sent it by hand and we
 * only record it, still within the daily limits.
 */
async function send(item: OutreachItem, viaProvider: boolean): Promise<OutreachActionState> {
  if (item.status !== "approved") return { error: "Godkänn utskicket innan det skickas." };
  const automated = viaProvider && integrations.linkedin.automated;
  if (viaProvider && !automated) return { error: "Automatiska utskick är inte inkopplade. Skicka själv och markera som skickat." };

  const store = await getStore();
  const checked = await contactableLead(item.leadId);
  if (!checked.ok) {
    await store.saveOutreach([{ ...item, status: "cancelled", cancelReason: checked.error }]);
    return { error: `${checked.error} Utskicket är avbrutet.` };
  }

  const [workspace, all] = await Promise.all([store.getWorkspace(), store.listOutreach()]);
  const now = new Date();
  const settings = sendingSettings(workspace.sending);
  const check = checkSend({ kind: item.kind, items: all, settings, state: workspace.sendingState, now, automated });
  if (!check.ok) return { error: check.reason };

  if (automated) {
    const response = await integrations.linkedin.send(item, checked.lead);
    if (response.pauseReason) {
      await store.saveWorkspace({
        ...workspace,
        sendingState: { ...workspace.sendingState, pausedAt: now.toISOString(), pauseReason: response.pauseReason },
      });
      return { error: `Utskicken är pausade. ${response.pauseReason}` };
    }
    if (!response.ok) return { error: response.error ?? "Det gick inte att skicka. Försök igen senare." };
    await store.saveWorkspace({
      ...workspace,
      sendingState: {
        ...workspace.sendingState,
        startedAt: workspace.sendingState?.startedAt ?? now.toISOString(),
        lastSentAt: now.toISOString(),
        nextSendNotBefore: new Date(now.getTime() + nextGapMs()).toISOString(),
      },
    });
  }

  await store.saveOutreach([{ ...item, status: "sent", sentAt: now.toISOString() }]);
  return { message: automated ? "Skickat via LinkedIn." : "Markerat som skickat." };
}
