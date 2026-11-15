"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseKeywords } from "../domain/normalize";
import { integrations } from "../integrations";
import { getStore } from "../store";
import type { Workspace } from "../types";

export type ProfileSuggestion = Pick<Workspace, "offer" | "idealCustomer" | "keywords">;

export type AnalyzeResult = { ok: true; profile: ProfileSuggestion } | { ok: false; error: string };

function normalizeWebsite(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Ask the AI provider to suggest offer, ideal customer and keywords from a website. */
export async function analyzeWebsite(websiteUrl: string): Promise<AnalyzeResult> {
  const url = normalizeWebsite(websiteUrl);
  if (!url) return { ok: false, error: "Ange en giltig webbadress, till exempel foretaget.se." };
  try {
    const profile = await integrations.ai.profileFromWebsite(url);
    return { ok: true, profile };
  } catch {
    return { ok: false, error: "Kunde inte läsa webbplatsen just nu. Fyll i uppgifterna själv." };
  }
}

export type SaveWorkspaceState = { error?: string; saved?: boolean };

export async function saveWorkspace(_prev: SaveWorkspaceState, formData: FormData): Promise<SaveWorkspaceState> {
  const store = await getStore();
  const current = await store.getWorkspace();

  const name = String(formData.get("name") ?? "").trim();
  const websiteUrl = normalizeWebsite(String(formData.get("websiteUrl") ?? ""));
  const offer = String(formData.get("offer") ?? "").trim();
  const idealCustomer = String(formData.get("idealCustomer") ?? "").trim();
  const keywords = parseKeywords(String(formData.get("keywords") ?? ""));
  const scanHour = Number(formData.get("scanHour"));
  const minFitScore = Number(formData.get("minFitScore"));
  const redirectTo = String(formData.get("redirectTo") ?? "");

  if (!name) return { error: "Ange företagets namn." };
  if (!websiteUrl) return { error: "Ange en giltig webbadress." };
  if (!offer) return { error: "Beskriv vad ni säljer." };
  if (!idealCustomer) return { error: "Beskriv er idealkund." };
  if (keywords.length === 0) return { error: "Lägg till minst ett sökord." };
  if (!Number.isInteger(scanHour) || scanHour < 0 || scanHour > 23) return { error: "Välj en timme mellan 0 och 23." };
  if (!Number.isInteger(minFitScore) || minFitScore < 0 || minFitScore > 100) {
    return { error: "Lägsta matchning ska vara ett heltal mellan 0 och 100." };
  }

  await store.saveWorkspace({
    ...current,
    name,
    websiteUrl,
    offer,
    idealCustomer,
    keywords,
    scanHour,
    minFitScore,
    onboardedAt: current.onboardedAt ?? new Date().toISOString(),
  });

  revalidatePath("/", "layout");
  if (redirectTo === "/leads") redirect("/leads");
  return { saved: true };
}
