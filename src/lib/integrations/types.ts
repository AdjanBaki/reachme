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

export interface LinkedInProvider {
  /** Find public posts, comments and likes that match the workspace keywords. */
  searchSignals(workspace: Workspace): Promise<RawSignal[]>;
  /** Send an approved invite or message from the customer's own account. */
  send(item: OutreachItem, lead: Lead): Promise<{ ok: boolean; error?: string }>;
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
