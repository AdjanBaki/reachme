"use server";

import { revalidatePath } from "next/cache";
import { isBlocked, isSuppressed } from "../domain/filters";
import { extractProfileUrls, nameFromProfileUrl, normalizeCompany, normalizeProfileUrl } from "../domain/normalize";
import { isPending } from "../domain/outreach";
import { getStore } from "../store";
import type { BlockEntry, BlockKind, Lead } from "../types";

export type FormState = { error?: string; message?: string };

const PROFILE_PATTERN = /linkedin\.com\/in\/[^/\s]+/i;
const MAX_IMPORT_BYTES = 1_000_000;
const MAX_IMPORT_ROWS = 1000;

function isBlockKind(value: unknown): value is BlockKind {
  return value === "profile" || value === "company";
}

/** Cancel queued outreach to anyone who is now blocked. */
async function cancelOutreachForBlocked(blockList: BlockEntry[]) {
  const store = await getStore();
  const [leads, outreach] = await Promise.all([store.listLeads(), store.listOutreach()]);
  const blockedIds = new Set(leads.filter((l) => isBlocked(l, blockList)).map((l) => l.id));
  const toCancel = outreach
    .filter((o) => blockedIds.has(o.leadId) && isPending(o))
    .map((o) => ({ ...o, status: "cancelled" as const, cancelReason: "Spärrad" }));
  if (toCancel.length > 0) await store.saveOutreach(toCancel);
  return toCancel.length;
}

export async function addBlockEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const kind = formData.get("kind");
  const value = String(formData.get("value") ?? "").trim();
  if (!isBlockKind(kind)) return { error: "Välj profil eller företag." };
  if (!value) return { error: kind === "profile" ? "Klistra in en profiladress." : "Ange ett företagsnamn." };
  if (kind === "profile" && !PROFILE_PATTERN.test(value)) {
    return { error: "Profiladressen ska se ut som linkedin.com/in/namn." };
  }

  const store = await getStore();
  const current = await store.listBlockList();
  const key = kind === "profile" ? normalizeProfileUrl(value) : normalizeCompany(value);
  const exists = current.some(
    (e) => e.kind === kind && (kind === "profile" ? normalizeProfileUrl(e.value) : normalizeCompany(e.value)) === key,
  );
  if (exists) return { error: "Finns redan på spärrlistan." };

  const workspace = await store.getWorkspace();
  const entry: BlockEntry = {
    id: `blk_${crypto.randomUUID()}`,
    workspaceId: workspace.id,
    kind,
    value,
    createdAt: new Date().toISOString(),
  };
  await store.addBlockEntry(entry);
  const cancelled = await cancelOutreachForBlocked([...current, entry]);

  revalidatePath("/", "layout");
  return {
    message: cancelled > 0 ? `Tillagd. ${cancelled} väntande utskick avbröts.` : "Tillagd på spärrlistan.",
  };
}

export async function removeBlockEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const store = await getStore();
  await store.removeBlockEntry(id);
  revalidatePath("/", "layout");
}

/** Delete everything about a person and make sure they are never added again. */
export async function createRemovalRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const profileUrl = String(formData.get("profileUrl") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim() || undefined;
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!PROFILE_PATTERN.test(profileUrl)) return { error: "Profiladressen ska se ut som linkedin.com/in/namn." };

  const store = await getStore();
  const removals = await store.listRemovalRequests();
  if (isSuppressed(profileUrl, removals)) return { error: "Det finns redan en borttagningsbegäran för den profilen." };

  const deleted = await store.deleteLeadsByProfileUrl(profileUrl);
  const workspace = await store.getWorkspace();
  await store.addRemovalRequest({
    id: `rem_${crypto.randomUUID()}`,
    workspaceId: workspace.id,
    profileUrl,
    fullName,
    note,
    requestedAt: new Date().toISOString(),
    deletedLeads: deleted,
  });

  revalidatePath("/", "layout");
  return {
    message:
      deleted > 0
        ? "Personens uppgifter och utskick är raderade. Profilen läggs aldrig till igen."
        : "Ingen data fanns sparad. Profilen läggs aldrig till framöver.",
  };
}

/** Import LinkedIn profile URLs from an uploaded CSV file or pasted text. */
export async function importLeadsCsv(_prev: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get("file");
  const pasted = String(formData.get("text") ?? "");
  let content = pasted;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMPORT_BYTES) return { error: "Filen är för stor (max 1 MB)." };
    content = `${await file.text()}\n${pasted}`;
  }
  const urls = extractProfileUrls(content);
  if (urls.length === 0) return { error: "Hittade inga LinkedIn-profiler (linkedin.com/in/…) i filen." };
  if (urls.length > MAX_IMPORT_ROWS) return { error: `Max ${MAX_IMPORT_ROWS} profiler per import.` };

  const store = await getStore();
  const [workspace, leads, blockList, removals] = await Promise.all([
    store.getWorkspace(),
    store.listLeads(),
    store.listBlockList(),
    store.listRemovalRequests(),
  ]);
  const existing = new Set(leads.map((l) => normalizeProfileUrl(l.profileUrl)));

  const now = new Date().toISOString();
  const added: Lead[] = [];
  let duplicates = 0;
  let skipped = 0;
  for (const profileUrl of urls) {
    if (existing.has(normalizeProfileUrl(profileUrl))) {
      duplicates++;
      continue;
    }
    if (isSuppressed(profileUrl, removals) || isBlocked({ profileUrl, company: "" }, blockList)) {
      skipped++;
      continue;
    }
    added.push({
      id: `lead_${crypto.randomUUID()}`,
      workspaceId: workspace.id,
      fullName: nameFromProfileUrl(profileUrl),
      headline: "Importerad från CSV",
      company: "",
      location: "",
      profileUrl,
      fitScore: 0,
      fitReason: "Importerad manuellt. Ingen matchning beräknad än.",
      outcome: "new",
      foundAt: now,
      source: "import",
    });
  }
  if (added.length > 0) await store.addLeads(added);

  revalidatePath("/", "layout");
  const parts = [`${added.length} ${added.length === 1 ? "ny lead importerad" : "nya leads importerade"}`];
  if (duplicates > 0) parts.push(`${duplicates} fanns redan`);
  if (skipped > 0) parts.push(`${skipped} spärrade hoppades över`);
  return { message: `${parts.join(", ")}.` };
}
