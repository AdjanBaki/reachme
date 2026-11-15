import type { Lead, OutreachItem, Workspace } from "./types";

export const sampleWorkspace: Workspace = {
  id: "ws_demo",
  name: "Demobyrån AB",
  websiteUrl: "https://example.se",
  offer: "AI-automation och chattbotar för små och medelstora tjänsteföretag.",
  idealCustomer: "VD eller marknadschef på svenska tjänsteföretag med 5–50 anställda.",
  keywords: ["AI-automation", "chattbot", "automatisera kundtjänst", "leadgenerering"],
  scanHour: 6,
  minFitScore: 80,
};

export const sampleLeads: Lead[] = [
  {
    id: "lead_1",
    workspaceId: "ws_demo",
    fullName: "Anna Lindqvist",
    headline: "VD på Lindqvist Redovisning",
    company: "Lindqvist Redovisning AB",
    location: "Göteborg",
    profileUrl: "https://www.linkedin.com/in/example-anna",
    signal: {
      kind: "post",
      text: "Vi drunknar i kundmejl den här tiden på året. Någon som har bra erfarenhet av att automatisera första svaret med AI? Tips mottages tacksamt!",
      url: "https://www.linkedin.com/posts/example-1",
      postedAt: "2026-11-14T08:12:00Z",
    },
    fitScore: 94,
    fitReason: "VD på tjänsteföretag i rätt storlek som uttryckligen ber om tips på AI-automation av kundmejl.",
    contact: { email: "anna@example.se", verified: true },
    outcome: "new",
    foundAt: "2026-11-15T05:00:00Z",
  },
  {
    id: "lead_2",
    workspaceId: "ws_demo",
    fullName: "Johan Berg",
    headline: "Marknadschef på Nordbygg Konsult",
    company: "Nordbygg Konsult AB",
    location: "Stockholm",
    profileUrl: "https://www.linkedin.com/in/example-johan",
    signal: {
      kind: "comment",
      text: "Intressant! Vi tittar just nu på en chattbot till vår hemsida men vet inte riktigt var vi ska börja.",
      url: "https://www.linkedin.com/posts/example-2",
      postedAt: "2026-11-13T14:40:00Z",
    },
    fitScore: 88,
    fitReason: "Beslutsfattare som säger att de utvärderar en chattbot just nu och saknar leverantör.",
    outcome: "new",
    foundAt: "2026-11-15T05:00:00Z",
  },
  {
    id: "lead_3",
    workspaceId: "ws_demo",
    fullName: "Sara Nyström",
    headline: "Ny som COO på Vårdkompassen",
    company: "Vårdkompassen AB",
    location: "Malmö",
    profileUrl: "https://www.linkedin.com/in/example-sara",
    signal: {
      kind: "new_role",
      text: "Glad att berätta att jag börjat som COO på Vårdkompassen. Första uppdraget: effektivisera våra interna flöden.",
      url: "https://www.linkedin.com/posts/example-3",
      postedAt: "2026-11-12T09:05:00Z",
    },
    fitScore: 82,
    fitReason: "Ny i roll med uttalat uppdrag att effektivisera flöden. Inget uttryckligt köpintresse ännu.",
    outcome: "new",
    foundAt: "2026-11-15T05:00:00Z",
  },
];

export const sampleOutreach: OutreachItem[] = [
  {
    id: "out_1",
    leadId: "lead_1",
    kind: "invite",
    body: "Hej Anna! Såg ditt inlägg om kundmejlen. Vi hjälper byråer med just det, delar gärna hur andra har löst det.",
    status: "ready",
    createdAt: "2026-11-15T05:01:00Z",
  },
  {
    id: "out_2",
    leadId: "lead_2",
    kind: "invite",
    body: "Hej Johan! Såg din kommentar om chattbot till hemsidan. Jag kan dela en kort checklista för var man börjar, om det är av intresse.",
    status: "ready",
    createdAt: "2026-11-15T05:01:00Z",
  },
];
