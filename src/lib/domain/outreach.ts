import { DAILY_LIMITS, type LeadOutcome, type OutreachItem, type OutreachKind } from "../types";

export const TIME_ZONE = "Europe/Stockholm";

/** Calendar day (YYYY-MM-DD) in Swedish time, used to reset daily quotas. */
export function dayKey(date: Date, timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Number of items of a kind already sent today. */
export function sentToday(items: OutreachItem[], kind: OutreachKind, now: Date): number {
  const today = dayKey(now);
  return items.filter(
    (item) => item.kind === kind && item.status === "sent" && item.sentAt && dayKey(new Date(item.sentAt)) === today,
  ).length;
}

/** Remaining quota per kind for today. Never negative. */
export function remainingQuota(items: OutreachItem[], now: Date): Record<OutreachKind, number> {
  const kinds = Object.keys(DAILY_LIMITS) as OutreachKind[];
  return Object.fromEntries(
    kinds.map((kind) => [kind, Math.max(0, DAILY_LIMITS[kind] - sentToday(items, kind, now))]),
  ) as Record<OutreachKind, number>;
}

/** True if one more item of this kind may be sent today. */
export function canSend(items: OutreachItem[], kind: OutreachKind, now: Date): boolean {
  return remainingQuota(items, now)[kind] > 0;
}

const PENDING = new Set(["ready", "approved"]);

export function isPending(item: OutreachItem): boolean {
  return PENDING.has(item.status);
}

/**
 * Apply the side effects of a new lead outcome to its outreach queue:
 * - a reply (and anything further along) stops pending follow-ups,
 * - "not a fit" cancels everything still waiting for that lead.
 * Returns a new array; items for other leads are untouched.
 */
export function applyOutcomeToOutreach(
  items: OutreachItem[],
  leadId: string,
  outcome: LeadOutcome,
): OutreachItem[] {
  const stopsFollowUps: LeadOutcome[] = ["responded", "interested", "booked", "converted"];
  return items.map((item) => {
    if (item.leadId !== leadId || !isPending(item)) return item;
    if (outcome === "not_a_fit") {
      return { ...item, status: "cancelled", cancelReason: "Markerad som inte relevant" };
    }
    if (stopsFollowUps.includes(outcome) && item.kind === "follow_up") {
      return { ...item, status: "cancelled", cancelReason: "Personen har svarat" };
    }
    return item;
  });
}
