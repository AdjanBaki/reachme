export type LeadOutcome =
  | "new"
  | "responded"
  | "interested"
  | "booked"
  | "converted"
  | "follow_up_later"
  | "not_a_fit";

export type SignalKind = "post" | "comment" | "like" | "new_role";

/** Where a lead came from: the daily signal scan or a manual CSV import. */
export type LeadSource = "scan" | "import";

export interface Workspace {
  id: string;
  name: string;
  websiteUrl: string;
  /** What the customer sells, in their own words (editable). */
  offer: string;
  /** Who buys it (editable). */
  idealCustomer: string;
  keywords: string[];
  /** Hour of day (0-23, Europe/Stockholm) for the daily scan. */
  scanHour: number;
  minFitScore: number;
  /** Set when the customer has completed onboarding. */
  onboardedAt?: string;
  /** When "Sök nu" (or a scheduled scan) last finished. */
  lastScanAt?: string;
  /** Sending pace for the LinkedIn account. Missing means defaults. */
  sending?: SendingSettings;
  /** Sending state used for pacing; written by the app. */
  sendingState?: SendingState;
}

export interface SendingSettings {
  /** Connection invites per day (capped by DAILY_LIMITS.invite). */
  invitesPerDay: number;
  /** Messages and follow-ups per day combined (capped by DAILY_LIMITS.message). */
  messagesPerDay: number;
  /** Start low and ramp up over the first two weeks of automated sending. */
  rampUp: boolean;
  /** Only send Monday-Friday between these hours (Europe/Stockholm). */
  weekdaysOnly: boolean;
  startHour: number;
  endHour: number;
}

export interface SendingState {
  /** First automated send; the ramp-up counts from here. */
  startedAt?: string;
  lastSentAt?: string;
  /** Earliest time the next automated send is allowed (random gap). */
  nextSendNotBefore?: string;
  /** Set when LinkedIn reported a restriction; sending stays paused until resumed. */
  pausedAt?: string;
  pauseReason?: string;
}

export interface LeadSignal {
  kind: SignalKind;
  text: string;
  url: string;
  postedAt: string; // ISO date
}

export interface Lead {
  id: string;
  workspaceId: string;
  fullName: string;
  headline: string;
  company: string;
  location: string;
  profileUrl: string;
  /** Missing for imported leads, which have no buying signal yet. */
  signal?: LeadSignal;
  fitScore: number; // 0-100
  fitReason: string;
  contact?: { email?: string; phone?: string; verified: boolean };
  outcome: LeadOutcome;
  foundAt: string; // ISO date
  /** Defaults to "scan" when missing. */
  source?: LeadSource;
}

export type OutreachKind = "invite" | "message" | "follow_up";
export type OutreachStatus = "ready" | "approved" | "sent" | "cancelled";

export interface OutreachItem {
  id: string;
  leadId: string;
  kind: OutreachKind;
  body: string;
  status: OutreachStatus;
  createdAt: string;
  sentAt?: string;
  /** Why an item was cancelled automatically, e.g. the lead replied. */
  cancelReason?: string;
}

/** Hard daily caps per connected LinkedIn account. */
export const DAILY_LIMITS: Record<OutreachKind, number> = {
  invite: 10,
  message: 50,
  follow_up: 50,
};

export type BlockKind = "profile" | "company";

/** A profile URL or company name that must never be shown or contacted. */
export interface BlockEntry {
  id: string;
  workspaceId: string;
  kind: BlockKind;
  value: string;
  createdAt: string;
}

/**
 * A person asked to have their data removed. The lead and its outreach are
 * deleted, and the profile URL stays here so it is never added again.
 */
export interface RemovalRequest {
  id: string;
  workspaceId: string;
  profileUrl: string;
  fullName?: string;
  note?: string;
  requestedAt: string;
  /** Number of leads deleted when the request was handled. */
  deletedLeads: number;
}
