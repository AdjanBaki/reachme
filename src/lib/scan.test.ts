import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiProvider, LinkedInProvider, RawSignal } from "./integrations/types";
import { runScan, summarizeScan } from "./scan";
import { JsonFileRepository } from "./store/json-store";

function signal(id: string, overrides: Partial<RawSignal> = {}): RawSignal {
  return {
    fullName: `Person ${id}`,
    headline: "VD",
    company: `Firma ${id} AB`,
    location: "",
    profileUrl: `https://www.linkedin.com/in/person-${id}`,
    signal: { kind: "post", text: `Inlägg ${id}`, url: `https://www.linkedin.com/posts/${id}`, postedAt: "2026-11-14T08:00:00Z" },
    ...overrides,
  };
}

function ai(scores: Record<string, number>): AiProvider {
  return {
    profileFromWebsite: vi.fn(),
    scoreSignal: vi.fn(async (_ws, s: RawSignal) => ({ fitScore: scores[s.fullName] ?? 90, fitReason: "Bra match." })),
    draftMessage: vi.fn(async () => "Hej! Såg ditt inlägg."),
  };
}

function linkedin(signals: RawSignal[]): LinkedInProvider {
  return { automated: true, searchSignals: vi.fn(async () => signals), send: vi.fn() };
}

describe("runScan", () => {
  let dir: string;
  let store: JsonFileRepository;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "reachme-scan-"));
    store = new JsonFileRepository(path.join(dir, "store.json"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("stores new leads at or above the threshold with a draft invite that is not approved", async () => {
    const before = (await store.listLeads()).length;
    const result = await runScan({
      store,
      ai: ai({ "Person low": 50 }),
      linkedin: linkedin([signal("a"), signal("b"), signal("low")]),
      now: () => new Date("2026-11-15T07:00:00Z"),
    });

    expect(result).toMatchObject({ postsRead: 3, newLeads: 2, belowThreshold: 1 });
    expect((await store.listLeads()).length).toBe(before + 2);
    const outreach = await store.listOutreach();
    const drafts = outreach.filter((o) => o.body === "Hej! Såg ditt inlägg.");
    expect(drafts).toHaveLength(2);
    expect(drafts.every((d) => d.status === "ready" && d.kind === "invite")).toBe(true);
    expect((await store.getWorkspace()).lastScanAt).toBe("2026-11-15T07:00:00.000Z");
  });

  it("skips people who are already leads, including duplicates in the same scan", async () => {
    const known = { ...signal("x"), profileUrl: "https://linkedin.com/in/example-anna/" };
    const provider = ai({});
    const result = await runScan({ store, ai: provider, linkedin: linkedin([known, signal("c"), signal("c")]) });
    expect(result).toMatchObject({ newLeads: 1, alreadyKnown: 2 });
    expect(provider.scoreSignal).toHaveBeenCalledTimes(1);
  });

  it("never scores or stores blocked or removed people", async () => {
    await store.addBlockEntry({ id: "b", workspaceId: "ws_demo", kind: "company", value: "Firma d", createdAt: "" });
    await store.addRemovalRequest({ id: "r", workspaceId: "ws_demo", profileUrl: "linkedin.com/in/person-e", requestedAt: "", deletedLeads: 0 });
    const provider = ai({});
    const result = await runScan({ store, ai: provider, linkedin: linkedin([signal("d"), signal("e")]) });
    expect(result).toMatchObject({ newLeads: 0, blocked: 2 });
    expect(provider.scoreSignal).not.toHaveBeenCalled();
  });

  it("reports AI errors but keeps going", async () => {
    const provider = ai({});
    vi.mocked(provider.scoreSignal).mockRejectedValueOnce(new Error("boom"));
    const result = await runScan({ store, ai: provider, linkedin: linkedin([signal("f"), signal("g")]) });
    expect(result).toMatchObject({ newLeads: 1, failed: 1 });
    expect(result.error).toBeTruthy();
  });

  it("returns a friendly error when the search fails", async () => {
    const broken: LinkedInProvider = { automated: true, searchSignals: vi.fn().mockRejectedValue(new Error("down")), send: vi.fn() };
    const result = await runScan({ store, ai: ai({}), linkedin: broken });
    expect(result.postsRead).toBe(0);
    expect(result.error).toContain("misslyckades");
  });

  it("summarizes in Swedish", () => {
    expect(summarizeScan({ postsRead: 12, newLeads: 3, alreadyKnown: 0, blocked: 0, belowThreshold: 0, failed: 0 })).toBe(
      "12 inlägg lästa, 3 nya leads",
    );
  });
});
