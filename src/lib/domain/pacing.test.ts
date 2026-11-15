import { describe, expect, it } from "vitest";
import type { OutreachItem } from "../types";
import { DEFAULT_SENDING, checkSend, effectiveLimits, nextGapMs, sendingSettings, withinSendingWindow } from "./pacing";

// Tuesday 2026-11-17 10:00 in Stockholm (09:00 UTC).
const tuesdayMorning = new Date("2026-11-17T09:00:00Z");
const saturday = new Date("2026-11-21T09:00:00Z");
const tuesdayNight = new Date("2026-11-17T21:00:00Z");

function sentInvites(count: number, at = "2026-11-17T08:00:00Z"): OutreachItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`,
    leadId: `l${i}`,
    kind: "invite" as const,
    body: "",
    status: "sent" as const,
    createdAt: at,
    sentAt: at,
  }));
}

describe("sending settings", () => {
  it("defaults to 10 invites and 20 messages a day", () => {
    expect(sendingSettings()).toMatchObject({ invitesPerDay: 10, messagesPerDay: 20, weekdaysOnly: true });
  });
  it("never goes above the hard daily limits", () => {
    expect(sendingSettings({ invitesPerDay: 500, messagesPerDay: 500 })).toMatchObject({ invitesPerDay: 10, messagesPerDay: 50 });
  });
});

describe("ramp-up", () => {
  it("starts at 5 invites on day one and reaches the setting after two weeks", () => {
    const start = { startedAt: "2026-11-17T08:00:00Z" };
    expect(effectiveLimits(DEFAULT_SENDING, start, tuesdayMorning, true).invite).toBe(5);
    expect(effectiveLimits(DEFAULT_SENDING, start, new Date("2026-11-24T09:00:00Z"), true).invite).toBe(7);
    expect(effectiveLimits(DEFAULT_SENDING, start, new Date("2026-12-01T09:00:00Z"), true).invite).toBe(10);
  });
  it("does not apply to manual sending or when turned off", () => {
    expect(effectiveLimits(DEFAULT_SENDING, undefined, tuesdayMorning, false).invite).toBe(10);
    expect(effectiveLimits({ ...DEFAULT_SENDING, rampUp: false }, undefined, tuesdayMorning, true).invite).toBe(10);
  });
});

describe("sending window", () => {
  it("allows weekdays during working hours only", () => {
    expect(withinSendingWindow(DEFAULT_SENDING, tuesdayMorning)).toBe(true);
    expect(withinSendingWindow(DEFAULT_SENDING, saturday)).toBe(false);
    expect(withinSendingWindow(DEFAULT_SENDING, tuesdayNight)).toBe(false);
  });
  it("allows weekends when the user turns that on", () => {
    expect(withinSendingWindow({ ...DEFAULT_SENDING, weekdaysOnly: false }, saturday)).toBe(true);
  });
});

describe("checkSend", () => {
  const base = { kind: "invite" as const, settings: DEFAULT_SENDING, now: tuesdayMorning };

  it("allows an automated send inside the window with quota left", () => {
    expect(checkSend({ ...base, items: [], state: { startedAt: "2026-11-01T08:00:00Z" }, automated: true }).ok).toBe(true);
  });

  it("blocks when the ramped-up limit is reached", () => {
    const result = checkSend({ ...base, items: sentInvites(5), state: { startedAt: "2026-11-17T07:00:00Z" }, automated: true });
    expect(result.ok).toBe(false);
  });

  it("blocks automated sends at night and on weekends, but not manual ones", () => {
    expect(checkSend({ ...base, now: tuesdayNight, items: [], state: undefined, automated: true }).ok).toBe(false);
    expect(checkSend({ ...base, now: saturday, items: [], state: undefined, automated: true }).ok).toBe(false);
    expect(checkSend({ ...base, now: saturday, items: [], state: undefined, automated: false }).ok).toBe(true);
  });

  it("waits for the random gap between sends", () => {
    const state = { startedAt: "2026-11-01T08:00:00Z", nextSendNotBefore: "2026-11-17T09:05:00Z" };
    expect(checkSend({ ...base, items: [], state, automated: true }).ok).toBe(false);
  });

  it("stays paused after a LinkedIn warning until resumed", () => {
    const state = { pausedAt: "2026-11-17T08:00:00Z", pauseReason: "Begränsat" };
    const result = checkSend({ ...base, items: [], state, automated: true });
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("pausade") });
  });

  it("caps manual sending by the user's setting too", () => {
    const settings = { ...DEFAULT_SENDING, invitesPerDay: 2 };
    expect(checkSend({ ...base, settings, items: sentInvites(2), state: undefined, automated: false }).ok).toBe(false);
  });
});

describe("nextGapMs", () => {
  it("waits between 3 and 9 minutes", () => {
    expect(nextGapMs(() => 0)).toBe(3 * 60_000);
    expect(nextGapMs(() => 1)).toBe(9 * 60_000);
  });
});
