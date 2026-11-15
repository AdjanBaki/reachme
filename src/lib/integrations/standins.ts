import { sampleLeads } from "../sample-data";
import type {
  AiProvider,
  BillingProvider,
  ContactProvider,
  EmailProvider,
  LinkedInProvider,
} from "./types";

/** Stand-ins used until the real services are connected. They never call the network. */

export const standInLinkedIn: LinkedInProvider = {
  automated: false,
  async searchSignals() {
    return sampleLeads.map(({ fullName, headline, company, location, profileUrl, signal }) => ({
      fullName,
      headline,
      company,
      location,
      profileUrl,
      signal,
    }));
  },
  async send() {
    return { ok: true };
  },
};

export const standInAi: AiProvider = {
  async profileFromWebsite() {
    return {
      offer: "Beskriv vad ni säljer (fylls i automatiskt när AI är inkopplad).",
      idealCustomer: "Beskriv er idealkund.",
      keywords: [],
    };
  },
  async scoreSignal(_workspace, signal) {
    const match = sampleLeads.find((l) => l.profileUrl === signal.profileUrl);
    return {
      fitScore: match?.fitScore ?? 50,
      fitReason: match?.fitReason ?? "Exempelpoäng (AI ej inkopplad).",
    };
  },
  async draftMessage(_workspace, lead) {
    return `Hej ${lead.fullName.split(" ")[0]}! Såg ditt inlägg och tänkte att vi kanske kan hjälpa till.`;
  },
};

export const standInContacts: ContactProvider = {
  async lookup(lead) {
    return lead.contact;
  },
};

export const standInEmail: EmailProvider = {
  async sendDailyDigest(to, _workspace, leads) {
    console.log(`[stand-in email] ${leads.length} leads till ${to}`);
  },
};

export const standInBilling: BillingProvider = {
  async startCheckout(_workspaceId, plan) {
    return `/abonnemang/demo?plan=${plan}`;
  },
  async isActive() {
    return true;
  },
};
