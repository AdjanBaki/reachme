import type { Lead, OutreachItem, Workspace } from "../types";

/**
 * Every outside service sits behind one of these interfaces.
 * The app only imports from `integrations/index.ts`, so a stand-in can be
 * swapped for the real service without touching the rest of the code.
 */

export interface RawSignal {
  fullName: string;
  headline: string;
  company: string;
  location: string;
  profileUrl: string;
  signal: Lead["signal"];
}

export interface SendResult {
  ok: boolean;
  /** Swedish message for the user when ok is false. */
  error?: string;
  /**
   * Set when LinkedIn reports a restriction, checkpoint or rate limit.
   * All sending is paused until the user resumes it.
   */
  pauseReason?: string;
}

export interface LinkedInProvider {
  /** True when this provider sends through the customer's account automatically. */
  readonly automated: boolean;
  /** Find public posts, comments and likes that match the workspace keywords. */
  searchSignals(workspace: Workspace): Promise<RawSignal[]>;
  /** Send an approved invite or message from the customer's own account. */
  send(item: OutreachItem, lead: Lead): Promise<SendResult>;
}

export interface AiProvider {
  /** Read the customer's website and suggest offer, ideal customer and keywords. */
  profileFromWebsite(
    websiteUrl: string,
  ): Promise<Pick<Workspace, "offer" | "idealCustomer" | "keywords">>;
  /** Score a signal against the workspace profile. */
  scoreSignal(
    workspace: Workspace,
    signal: RawSignal,
  ): Promise<{ fitScore: number; fitReason: string }>;
  /** Draft a Swedish message for the lead. */
  draftMessage(workspace: Workspace, lead: Lead, kind: OutreachItem["kind"]): Promise<string>;
}

export interface ContactProvider {
  lookup(lead: Lead): Promise<Lead["contact"] | undefined>;
}

export interface EmailProvider {
  sendDailyDigest(to: string, workspace: Workspace, leads: Lead[]): Promise<void>;
}

export interface BillingProvider {
  /** Returns a URL where the customer completes checkout. */
  startCheckout(workspaceId: string, plan: "monthly" | "yearly"): Promise<string>;
  isActive(workspaceId: string): Promise<boolean>;
}
