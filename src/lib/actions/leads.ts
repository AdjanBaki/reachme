"use server";

import { revalidatePath } from "next/cache";
import { applyOutcomeToOutreach } from "../domain/outreach";
import { integrations } from "../integrations";
import { outcomeOrder } from "../labels";
import { getStore } from "../store";
import type { LeadOutcome } from "../types";

function isOutcome(value: unknown): value is LeadOutcome {
  return typeof value === "string" && (outcomeOrder as string[]).includes(value);
}

async function updateOutcome(leadId: string, outcome: LeadOutcome) {
  const store = await getStore();
  const lead = await store.updateLead(leadId, { outcome });
  if (!lead) return;

  // A reply stops follow-ups; "not a fit" cancels everything still pending.
  const before = await store.listOutreach();
  const after = applyOutcomeToOutreach(before, leadId, outcome);
  const changed = after.filter((item, i) => item !== before[i]);
  if (changed.length > 0) await store.saveOutreach(changed);

  revalidatePath("/", "layout");
}

export async function setLeadOutcome(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const outcome = formData.get("outcome");
  if (!leadId || !isOutcome(outcome)) return;
  await updateOutcome(leadId, outcome);
}

export async function markLeadNotRelevant(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return;
  await updateOutcome(leadId, "not_a_fit");
}

/** Look up contact details through the contact provider and store them on the lead. */
export async function lookupLeadContact(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const store = await getStore();
  const lead = await store.getLead(leadId);
  if (!lead) return;
  const contact = await integrations.contacts.lookup(lead);
  await store.updateLead(leadId, { contact: contact ?? { verified: false } });
  revalidatePath("/", "layout");
}
