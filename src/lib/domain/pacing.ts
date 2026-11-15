import { DAILY_LIMITS, type OutreachItem, type OutreachKind, type SendingSettings, type SendingState } from "../types";
import { TIME_ZONE, dayKey, sentToday } from "./outreach";

/**
 * Conservative sending pace for automated LinkedIn sending:
 * per-day caps well under the hard limits, a ramp-up for new accounts,
 * working hours only and random gaps between sends.
 */

export const DEFAULT_SENDING: SendingSettings = {
  invitesPerDay: 10,
  messagesPerDay: 20,
  rampUp: true,
  weekdaysOnly: true,
  startHour: 8,
  endHour: 17,
};

export const RAMP_UP_DAYS = 14;
export const RAMP_START_INVITES = 5;
export const RAMP_START_MESSAGES = 10;
export const MIN_GAP_MINUTES = 3;
export const MAX_GAP_MINUTES = 9;

export function sendingSettings(settings?: Partial<SendingSettings>): SendingSettings {
  const merged = { ...DEFAULT_SENDING, ...settings };
  return {
    ...merged,
    invitesPerDay: clampInt(merged.invitesPerDay, 0, DAILY_LIMITS.invite),
    messagesPerDay: clampInt(merged.messagesPerDay, 0, DAILY_LIMITS.message),
    startHour: clampInt(merged.startHour, 0, 23),
    endHour: clampInt(merged.endHour, 1, 24),
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function daysBetween(fromIso: string, now: Date): number {
  const from = new Date(`${dayKey(new Date(fromIso))}T00:00:00Z`).getTime();
  const to = new Date(`${dayKey(now)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/** Linear ramp from `start` to `target` over the ramp-up period. */
function ramp(target: number, start: number, day: number): number {
  if (target <= start) return target;
  if (day >= RAMP_UP_DAYS) return target;
  return Math.floor(start + ((target - start) * day) / RAMP_UP_DAYS);
}

export type GroupedKind = "invite" | "messages";

function group(kind: OutreachKind): GroupedKind {
  return kind === "invite" ? "invite" : "messages";
}

/** Today's caps after settings and ramp-up. Ramp-up only applies to automated sending. */
export function effectiveLimits(
  settings: SendingSettings,
  state: SendingState | undefined,
  now: Date,
  automated: boolean,
): Record<GroupedKind, number> {
  let invites = settings.invitesPerDay;
  let messages = settings.messagesPerDay;
  if (automated && settings.rampUp) {
    const day = state?.startedAt ? daysBetween(state.startedAt, now) : 0;
    invites = ramp(invites, RAMP_START_INVITES, day);
    messages = ramp(messages, RAMP_START_MESSAGES, day);
  }
  return { invite: invites, messages };
}

/** Remaining sends today per group (invites, messages + follow-ups). */
export function remainingToday(
  items: OutreachItem[],
  settings: SendingSettings,
  state: SendingState | undefined,
  now: Date,
  automated: boolean,
): Record<GroupedKind, number> {
  const limits = effectiveLimits(settings, state, now, automated);
  const sentInvites = sentToday(items, "invite", now);
  const sentMessages = sentToday(items, "message", now) + sentToday(items, "follow_up", now);
  return {
    invite: Math.max(0, limits.invite - sentInvites),
    messages: Math.max(0, limits.messages - sentMessages),
  };
}

function stockholmParts(now: Date): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);
  return { weekday, hour };
}

export function withinSendingWindow(settings: SendingSettings, now: Date): boolean {
  const { weekday, hour } = stockholmParts(now);
  if (settings.weekdaysOnly && (weekday === 0 || weekday === 6)) return false;
  return hour >= settings.startHour && hour < settings.endHour;
}

export type SendCheck = { ok: true } | { ok: false; reason: string };

/** Decide whether one more item may be sent now. */
export function checkSend(input: {
  kind: OutreachKind;
  items: OutreachItem[];
  settings: SendingSettings;
  state: SendingState | undefined;
  now: Date;
  automated: boolean;
}): SendCheck {
  const { kind, items, settings, state, now, automated } = input;

  if (automated && state?.pausedAt) {
    return { ok: false, reason: "Utskicken är pausade efter en varning från LinkedIn. Återuppta under Inställningar." };
  }

  // The hard limits always apply, whatever the settings say.
  if (sentToday(items, kind, now) >= DAILY_LIMITS[kind]) {
    return { ok: false, reason: "Dagens maxgräns är nådd. Försök igen i morgon." };
  }
  const remaining = remainingToday(items, settings, state, now, automated);
  if (remaining[group(kind)] <= 0) {
    return { ok: false, reason: "Dagens gräns enligt dina inställningar är nådd. Försök igen i morgon." };
  }

  if (automated) {
    if (!withinSendingWindow(settings, now)) {
      const days = settings.weekdaysOnly ? "vardagar " : "";
      return {
        ok: false,
        reason: `Utskick sker bara ${days}mellan ${pad(settings.startHour)}:00 och ${pad(settings.endHour)}:00.`,
      };
    }
    if (state?.nextSendNotBefore && new Date(state.nextSendNotBefore) > now) {
      return { ok: false, reason: `Vänta till ${formatTime(state.nextSendNotBefore)} innan nästa utskick.` };
    }
  }
  return { ok: true };
}

/** Random gap before the next automated send. `random` is injectable for tests. */
export function nextGapMs(random: () => number = Math.random): number {
  const minutes = MIN_GAP_MINUTES + random() * (MAX_GAP_MINUTES - MIN_GAP_MINUTES);
  return Math.round(minutes * 60_000);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
