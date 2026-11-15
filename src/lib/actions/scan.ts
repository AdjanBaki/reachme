"use server";

import { revalidatePath } from "next/cache";
import { integrations } from "../integrations";
import { processSignals, runScan, summarizeScan } from "../scan";
import { getStore } from "../store";

export type ScanState = { error?: string; message?: string };

/** "Sök nu": search LinkedIn, score and store new leads with draft invites. */
export async function scanNow(): Promise<ScanState> {
  const store = await getStore();
  const result = await runScan({ store, ai: integrations.ai, linkedin: integrations.linkedin });
  revalidatePath("/", "layout");
  const summary = summarizeScan(result);
  return result.error ? { error: `${summary}. ${result.error}` } : { message: `${summary}.` };
}

const PROFILE_PATTERN = /linkedin\.com\/in\/[^/\s]+/i;

/** Manual path: paste a post you found on LinkedIn and let the AI assess it. */
export async function addPost(_prev: ScanState, formData: FormData): Promise<ScanState> {
  const profileUrl = String(formData.get("profileUrl") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const postUrl = String(formData.get("postUrl") ?? "").trim();

  if (!PROFILE_PATTERN.test(profileUrl)) return { error: "Profiladressen ska se ut som linkedin.com/in/namn." };
  if (!fullName) return { error: "Ange personens namn." };
  if (text.length < 10) return { error: "Klistra in inläggets text." };
  if (postUrl && !/^https:\/\/(www\.)?linkedin\.com\//i.test(postUrl)) {
    return { error: "Länken till inlägget ska vara en LinkedIn-adress." };
  }

  const store = await getStore();
  const url = /^https?:\/\//i.test(profileUrl) ? profileUrl : `https://${profileUrl}`;
  const result = await processSignals(
    [
      {
        fullName,
        headline,
        company: headline.match(/\s(?:på|at|@)\s+([^|,·•]+)/i)?.[1]?.trim() ?? "",
        location: "",
        profileUrl: url,
        signal: { kind: "post", text, url: postUrl || url, postedAt: new Date().toISOString() },
      },
    ],
    { store, ai: integrations.ai },
  );
  revalidatePath("/", "layout");

  if (result.error && result.newLeads === 0) return { error: result.error };
  if (result.newLeads === 1) return { message: "Tillagd som lead med ett utkast till kontaktförfrågan." };
  if (result.alreadyKnown) return { error: "Personen finns redan bland dina leads." };
  if (result.blocked) return { error: "Personen finns på spärrlistan." };
  if (result.belowThreshold) return { message: "Personen matchade under din gräns och lades inte till." };
  return { error: "Kunde inte lägga till inlägget." };
}
