import { describe, expect, it } from "vitest";
import { DAILY_LIMITS, type OutreachItem, type OutreachKind } from "../types";
import { applyOutcomeToOutreach, canSend, dayKey, remainingQuota, sentToday } from "./outreach";

let counter = 0;
function item(overrides: Partial<OutreachItem> = {}): OutreachItem {
  counter++;
  return {
    id: `out_${counter}`,
    leadId: "lead_1",
    kind: "invite",
    body: "Hej!",
    status: "ready",
    createdAt: "2026-11-15T05:00:00Z",
    ...overrides,
  };
}

function sent(kind: OutreachKind, count: number, sentAt: string): OutreachItem[] {
  return Array.from({ length: count }, () => item({ kind, status: "sent", sentAt }));
}

describe("daily limits", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  it("allows sending when nothing has been sent today", () => {
    expect(remainingQuota([], now)).toEqual(DAILY_LIMITS);
    expect(canSend([], "invite", now)).toBe(true);
  });

  it("blocks invites once the daily limit is reached", () => {
    const items = sent("invite", DAILY_LIMITS.invite, "2026-11-15T08:00:00Z");
    expect(sentToday(items, "invite", now)).toBe(DAILY_LIMITS.invite);
    expect(remainingQuota(items, now).invite).toBe(0);
    expect(canSend(items, "invite", now)).toBe(false);
  });

  it("allows one more right below the limit", () => {
    const items = sent("invite", DAILY_LIMITS.invite - 1, "2026-11-15T08:00:00Z");
    expect(canSend(items, "invite", now)).toBe(true);
    expect(remainingQuota(items, now).invite).toBe(1);
  });

  it("counts each kind separately", () => {
    const items = sent("invite", DAILY_LIMITS.invite, "2026-11-15T08:00:00Z");
    expect(canSend(items, "message", now)).toBe(true);
    expect(canSend(items, "follow_up", now)).toBe(true);
  });

  it("does not count items sent on an earlier day", () => {
    const items = sent("invite", DAILY_LIMITS.invite, "2026-11-14T08:00:00Z");
    expect(canSend(items, "invite", now)).toBe(true);
  });

  it("does not count drafts, approved or cancelled items", () => {
    const items = [
      item({ status: "ready" }),
      item({ status: "approved" }),
      item({ status: "cancelled", sentAt: "2026-11-15T08:00:00Z" }),
    ];
    expect(remainingQuota(items, now).invite).toBe(DAILY_LIMITS.invite);
  });

  it("resets at midnight Swedish time, not UTC", () => {
    // 23:30 UTC on Nov 14 is 00:30 on Nov 15 in Stockholm (CET, UTC+1).
    const sentJustAfterSwedishMidnight = sent("invite", DAILY_LIMITS.invite, "2026-11-14T23:30:00Z");
    expect(dayKey(new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-15");
    expect(canSend(sentJustAfterSwedishMidnight, "invite", now)).toBe(false);

    // 22:30 UTC on Nov 14 is still Nov 14 in Stockholm.
    const sentBeforeSwedishMidnight = sent("invite", DAILY_LIMITS.invite, "2026-11-14T22:30:00Z");
    expect(canSend(sentBeforeSwedishMidnight, "invite", now)).toBe(true);
  });
});

describe("reply stops follow-ups", () => {
  it("cancels pending follow-ups when the lead responds", () => {
    const followUp = item({ kind: "follow_up", status: "ready" });
    const approvedFollowUp = item({ kind: "follow_up", status: "approved" });
    const result = applyOutcomeToOutreach([followUp, approvedFollowUp], "lead_1", "responded");
    expect(result.map((i) => i.status)).toEqual(["cancelled", "cancelled"]);
    expect(result[0].cancelReason).toBe("Personen har svarat");
  });

  it("keeps invites and messages when the lead responds", () => {
    const invite = item({ kind: "invite" });
    const message = item({ kind: "message" });
    const result = applyOutcomeToOutreach([invite, message], "lead_1", "responded");
    expect(result.map((i) => i.status)).toEqual(["ready", "ready"]);
  });

  it("does not touch follow-ups that were already sent", () => {
    const done = item({ kind: "follow_up", status: "sent", sentAt: "2026-11-14T10:00:00Z" });
    const [result] = applyOutcomeToOutreach([done], "lead_1", "responded");
    expect(result).toBe(done);
  });

  it("only affects the lead that responded", () => {
    const other = item({ kind: "follow_up", leadId: "lead_2" });
    const [result] = applyOutcomeToOutreach([other], "lead_1", "responded");
    expect(result.status).toBe("ready");
  });

  it("also stops follow-ups for interested, booked and converted", () => {
    for (const outcome of ["interested", "booked", "converted"] as const) {
      const [result] = applyOutcomeToOutreach([item({ kind: "follow_up" })], "lead_1", outcome);
      expect(result.status).toBe("cancelled");
    }
  });

  it("cancels everything pending when marked not a fit", () => {
    const items = [item({ kind: "invite" }), item({ kind: "message", status: "approved" }), item({ kind: "follow_up" })];
    const result = applyOutcomeToOutreach(items, "lead_1", "not_a_fit");
    expect(result.every((i) => i.status === "cancelled")).toBe(true);
  });

  it("leaves the queue alone for follow up later", () => {
    const followUp = item({ kind: "follow_up" });
    const [result] = applyOutcomeToOutreach([followUp], "lead_1", "follow_up_later");
    expect(result).toBe(followUp);
  });
});
