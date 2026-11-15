export type LeadOutcome =
  | "new"
  | "responded"
  | "interested"
  | "booked"
  | "converted"
  | "follow_up_later"
  | "not_a_fit";

export type SignalKind = "post" | "comment" | "like" | "new_role";

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
}

export interface Lead {
  id: string;
  workspaceId: string;
  fullName: string;
  headline: string;
  company: string;
  location: string;
  profileUrl: string;
  signal: {
    kind: SignalKind;
    text: string;
    url: string;
    postedAt: string; // ISO date
  };
  fitScore: number; // 0-100
  fitReason: string;
  contact?: { email?: string; phone?: string; verified: boolean };
  outcome: LeadOutcome;
  foundAt: string; // ISO date
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
}

/** Hard daily caps per connected LinkedIn account. */
export const DAILY_LIMITS: Record<OutreachKind, number> = {
  invite: 10,
  message: 50,
  follow_up: 50,
};
