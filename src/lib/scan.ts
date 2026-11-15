import { isBlocked, isSuppressed } from "./domain/filters";
import { normalizeProfileUrl } from "./domain/normalize";
import { userMessageFor } from "./integrations/errors";
import type { AiProvider, LinkedInProvider, RawSignal } from "./integrations/types";
import type { Repository } from "./store/types";
import type { Lead, OutreachItem } from "./types";

export interface ScanResult {
  postsRead: number;
  newLeads: number;
  alreadyKnown: number;
  blocked: number;
  belowThreshold: number;
  failed: number;
  /** First error message, shown when something went wrong. */
  error?: string;
}

export interface ScanDeps {
  store: Repository;
  ai: AiProvider;
  now?: () => Date;
  makeId?: (prefix: string) => string;
}

const defaultId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

/**
 * Score signals and store the good ones as leads, each with a draft invite.
 * Drafts are always "ready", never approved: nothing is sent without the user.
 */
export async function processSignals(signals: RawSignal[], deps: ScanDeps): Promise<ScanResult> {
  const { store, ai } = deps;
  const now = deps.now ?? (() => new Date());
  const makeId = deps.makeId ?? defaultId;

  const [workspace, leads, blockList, removals] = await Promise.all([
    store.getWorkspace(),
    store.listLeads(),
    store.listBlockList(),
    store.listRemovalRequests(),
  ]);
  const known = new Set(leads.map((l) => normalizeProfileUrl(l.profileUrl)));

  const result: ScanResult = {
    postsRead: signals.length,
    newLeads: 0,
    alreadyKnown: 0,
    blocked: 0,
    belowThreshold: 0,
    failed: 0,
  };

  for (const signal of signals) {
    const key = normalizeProfileUrl(signal.profileUrl);
    if (known.has(key)) {
      result.alreadyKnown++;
      continue;
    }
    if (isBlocked(signal, blockList) || isSuppressed(signal.profileUrl, removals)) {
      result.blocked++;
      continue;
    }
    known.add(key);

    let score: { fitScore: number; fitReason: string };
    try {
      score = await ai.scoreSignal(workspace, signal);
    } catch (error) {
      result.failed++;
      result.error ??= userMessageFor(error, "Kunde inte bedöma ett inlägg.");
      known.delete(key);
      continue;
    }
    if (score.fitScore < workspace.minFitScore) {
      result.belowThreshold++;
      continue;
    }

    const lead: Lead = {
      id: makeId("lead"),
      workspaceId: workspace.id,
      fullName: signal.fullName,
      headline: signal.headline,
      company: signal.company,
      location: signal.location,
      profileUrl: signal.profileUrl,
      signal: signal.signal,
      fitScore: score.fitScore,
      fitReason: score.fitReason,
      outcome: "new",
      foundAt: now().toISOString(),
      source: "scan",
    };
    await store.addLeads([lead]);
    result.newLeads++;

    try {
      const body = await ai.draftMessage(workspace, lead, "invite");
      const draft: OutreachItem = {
        id: makeId("out"),
        leadId: lead.id,
        kind: "invite",
        body,
        status: "ready",
        createdAt: now().toISOString(),
      };
      await store.addOutreach(draft);
    } catch (error) {
      // The lead is still useful without a draft; the user can write one.
      result.error ??= userMessageFor(error, "Kunde inte skriva ett utkast.");
    }
  }
  return result;
}

/** Search LinkedIn for new signals, then process them. Records the scan time. */
export async function runScan(deps: ScanDeps & { linkedin: LinkedInProvider }): Promise<ScanResult> {
  const now = deps.now ?? (() => new Date());
  const workspace = await deps.store.getWorkspace();
  let signals: RawSignal[];
  try {
    signals = await deps.linkedin.searchSignals(workspace);
  } catch (error) {
    return {
      postsRead: 0,
      newLeads: 0,
      alreadyKnown: 0,
      blocked: 0,
      belowThreshold: 0,
      failed: 0,
      error: userMessageFor(error, "Sökningen på LinkedIn misslyckades. Försök igen senare."),
    };
  }
  const result = await processSignals(signals, deps);
  const latest = await deps.store.getWorkspace();
  await deps.store.saveWorkspace({ ...latest, lastScanAt: now().toISOString() });
  return result;
}

/** Short Swedish summary, e.g. "12 inlägg lästa, 3 nya leads". */
export function summarizeScan(result: ScanResult): string {
  const parts = [`${result.postsRead} inlägg lästa`, `${result.newLeads} ${result.newLeads === 1 ? "ny lead" : "nya leads"}`];
  if (result.alreadyKnown) parts.push(`${result.alreadyKnown} redan kända`);
  if (result.belowThreshold) parts.push(`${result.belowThreshold} under gränsen`);
  if (result.blocked) parts.push(`${result.blocked} spärrade`);
  if (result.failed) parts.push(`${result.failed} kunde inte bedömas`);
  return parts.join(", ");
}
