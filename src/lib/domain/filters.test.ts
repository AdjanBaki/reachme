import { describe, expect, it } from "vitest";
import type { BlockEntry, Lead, RemovalRequest } from "../types";
import { isBlocked, isSuppressed, meetsMinScore, visibleLeads } from "./filters";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: overrides.id ?? "lead_1",
    workspaceId: "ws",
    fullName: "Anna Lindqvist",
    headline: "VD",
    company: "Lindqvist Redovisning AB",
    location: "Göteborg",
    profileUrl: "https://www.linkedin.com/in/anna-lindqvist",
    signal: { kind: "post", text: "Tips?", url: "https://www.linkedin.com/posts/1", postedAt: "2026-11-14T08:00:00Z" },
    fitScore: 90,
    fitReason: "",
    outcome: "new",
    foundAt: "2026-11-15T05:00:00Z",
    ...overrides,
  };
}

function block(kind: BlockEntry["kind"], value: string): BlockEntry {
  return { id: `b_${value}`, workspaceId: "ws", kind, value, createdAt: "2026-11-15T00:00:00Z" };
}

describe("block list filtering", () => {
  it("matches a profile URL regardless of protocol, www, case, query and trailing slash", () => {
    const entry = block("profile", "linkedin.com/in/Anna-Lindqvist/?utm_source=x");
    expect(isBlocked(lead(), [entry])).toBe(true);
  });

  it("matches a company name regardless of case and a trailing AB", () => {
    expect(isBlocked(lead(), [block("company", "lindqvist redovisning")])).toBe(true);
    expect(isBlocked(lead(), [block("company", "LINDQVIST REDOVISNING AB")])).toBe(true);
  });

  it("does not match other people or companies", () => {
    const entries = [block("profile", "linkedin.com/in/anna-lindqvist-2"), block("company", "Lindqvist")];
    expect(isBlocked(lead(), entries)).toBe(false);
  });

  it("never matches a company block against an empty company", () => {
    expect(isBlocked(lead({ company: "" }), [block("company", "AB")])).toBe(false);
  });

  it("hides blocked leads from the visible list", () => {
    const leads = [lead({ id: "a" }), lead({ id: "b", profileUrl: "https://www.linkedin.com/in/other", company: "Annat AB" })];
    const result = visibleLeads(leads, { minFitScore: 0 }, [block("company", "Lindqvist Redovisning AB")]);
    expect(result.map((l) => l.id)).toEqual(["b"]);
  });

  it("hides people with a removal request", () => {
    const removal: RemovalRequest = {
      id: "r",
      workspaceId: "ws",
      profileUrl: "http://linkedin.com/in/anna-lindqvist/",
      requestedAt: "2026-11-15T00:00:00Z",
      deletedLeads: 1,
    };
    expect(isSuppressed(lead().profileUrl, [removal])).toBe(true);
    expect(visibleLeads([lead()], { minFitScore: 0 }, [], [removal])).toEqual([]);
  });
});

describe("min score filtering", () => {
  it("keeps leads at or above the minimum and drops those below", () => {
    expect(meetsMinScore(lead({ fitScore: 80 }), 80)).toBe(true);
    expect(meetsMinScore(lead({ fitScore: 79 }), 80)).toBe(false);
  });

  it("always keeps imported leads, which have no score yet", () => {
    expect(meetsMinScore(lead({ fitScore: 0, source: "import" }), 80)).toBe(true);
  });

  it("filters and sorts the visible list by score", () => {
    const leads = [
      lead({ id: "low", fitScore: 60 }),
      lead({ id: "mid", fitScore: 82 }),
      lead({ id: "high", fitScore: 95 }),
    ];
    expect(visibleLeads(leads, { minFitScore: 80 }, []).map((l) => l.id)).toEqual(["high", "mid"]);
  });

  it("combines score with outcome and signal filters", () => {
    const leads = [
      lead({ id: "a", fitScore: 90, outcome: "responded" }),
      lead({ id: "b", fitScore: 90, signal: { kind: "comment", text: "", url: "", postedAt: "" } }),
      lead({ id: "c", fitScore: 70, outcome: "responded" }),
    ];
    expect(visibleLeads(leads, { minFitScore: 80, outcome: "responded" }, []).map((l) => l.id)).toEqual(["a"]);
    expect(visibleLeads(leads, { minFitScore: 80, signalKind: "comment" }, []).map((l) => l.id)).toEqual(["b"]);
  });
});
