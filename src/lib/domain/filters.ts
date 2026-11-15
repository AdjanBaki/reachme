import type { BlockEntry, Lead, LeadOutcome, RemovalRequest, SignalKind } from "../types";
import { normalizeCompany, normalizeProfileUrl } from "./normalize";

/** True if the lead matches a blocked profile URL or company name. */
export function isBlocked(lead: Pick<Lead, "profileUrl" | "company">, blockList: BlockEntry[]): boolean {
  const url = normalizeProfileUrl(lead.profileUrl);
  const company = normalizeCompany(lead.company);
  return blockList.some((entry) =>
    entry.kind === "profile"
      ? normalizeProfileUrl(entry.value) === url
      : company !== "" && normalizeCompany(entry.value) === company,
  );
}

/** True if a removal request exists for this profile URL. */
export function isSuppressed(profileUrl: string, removals: RemovalRequest[]): boolean {
  const url = normalizeProfileUrl(profileUrl);
  return removals.some((r) => normalizeProfileUrl(r.profileUrl) === url);
}

/**
 * Scanned leads must reach the workspace's minimum fit score. Imported leads
 * were added on purpose by the customer, so they are always kept.
 */
export function meetsMinScore(lead: Lead, minFitScore: number): boolean {
  if (lead.source === "import") return true;
  return lead.fitScore >= minFitScore;
}

export interface LeadFilter {
  minFitScore: number;
  outcome?: LeadOutcome;
  signalKind?: SignalKind;
}

/** Leads the customer should see: not blocked, not suppressed, above the score bar. */
export function visibleLeads(
  leads: Lead[],
  filter: LeadFilter,
  blockList: BlockEntry[],
  removals: RemovalRequest[] = [],
): Lead[] {
  return leads
    .filter((lead) => !isBlocked(lead, blockList))
    .filter((lead) => !isSuppressed(lead.profileUrl, removals))
    .filter((lead) => meetsMinScore(lead, filter.minFitScore))
    .filter((lead) => !filter.outcome || lead.outcome === filter.outcome)
    .filter((lead) => !filter.signalKind || lead.signal?.kind === filter.signalKind)
    .sort((a, b) => b.fitScore - a.fitScore || b.foundAt.localeCompare(a.foundAt));
}
