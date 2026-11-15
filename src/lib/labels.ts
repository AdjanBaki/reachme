import type { BlockKind, LeadOutcome, OutreachKind, OutreachStatus, SignalKind } from "./types";

export const outcomeLabel: Record<LeadOutcome, string> = {
  new: "Ny",
  responded: "Svarat",
  interested: "Intresserad",
  booked: "Bokat möte",
  converted: "Kund",
  follow_up_later: "Följ upp senare",
  not_a_fit: "Inte relevant",
};

export const outcomeOrder: LeadOutcome[] = [
  "new",
  "responded",
  "interested",
  "booked",
  "converted",
  "follow_up_later",
  "not_a_fit",
];

export const signalLabel: Record<SignalKind, string> = {
  post: "Inlägg",
  comment: "Kommentar",
  like: "Gillning",
  new_role: "Ny roll",
};

export const outreachKindLabel: Record<OutreachKind, string> = {
  invite: "Kontaktförfrågan",
  message: "Meddelande",
  follow_up: "Uppföljning",
};

export const outreachStatusLabel: Record<OutreachStatus, string> = {
  ready: "Utkast",
  approved: "Godkänd",
  sent: "Skickad",
  cancelled: "Avbruten",
};

export const blockKindLabel: Record<BlockKind, string> = {
  profile: "Profil",
  company: "Företag",
};

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "medium",
  }).format(new Date(iso));
}
