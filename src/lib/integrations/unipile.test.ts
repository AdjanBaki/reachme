import { describe, expect, it, vi } from "vitest";
import { sampleLeads, sampleWorkspace } from "../sample-data";
import type { OutreachItem } from "../types";
import { UnipileLinkedInProvider, baseUrl, companyFromHeadline, publicIdentifier, toRawSignal } from "./unipile";

const config = { apiKey: "test-key", dsn: "", accountId: "acc_1" };
const BASE = "https://api.unipile.com/v2/acc_1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function profile(networkDistance: string, extra: Record<string, unknown> = {}) {
  return json({ object: "UserProfile", id: "ACo123", specifics: { network_distance: networkDistance, ...extra } });
}

const invite: OutreachItem = {
  id: "o1",
  leadId: "lead_1",
  kind: "invite",
  body: "Hej Anna!",
  status: "approved",
  createdAt: "2026-11-15T05:00:00Z",
};

describe("baseUrl", () => {
  it("defaults to the v2 address and normalizes what the user enters", () => {
    expect(baseUrl("")).toBe("https://api.unipile.com/v2");
    expect(baseUrl("https://api.unipile.com/v2/")).toBe("https://api.unipile.com/v2");
    expect(baseUrl("api.unipile.com")).toBe("https://api.unipile.com/v2");
  });
});

describe("UnipileLinkedInProvider.searchSignals", () => {
  it("searches recent posts per keyword and maps individual authors", async () => {
    const http = vi.fn().mockResolvedValue(
      json({
        data: [
          {
            object: "PostSearchResult",
            share_url: "https://www.linkedin.com/posts/1",
            created_at: "2026-11-14T08:00:00.000Z",
            text: "Någon som testat en chattbot på svenska?",
            author: {
              type: "individual",
              display_name: "Erik Holm",
              public_identifier: "erik-holm",
              profile_url: "https://www.linkedin.com/in/erik-holm",
              description: "VD på Holm AB",
            },
          },
          { text: "Företagsinlägg", author: { type: "organization", display_name: "Firma" } },
        ],
      }),
    );
    const provider = new UnipileLinkedInProvider(config, http);
    const signals = await provider.searchSignals({ ...sampleWorkspace, keywords: ["chattbot"] });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      fullName: "Erik Holm",
      headline: "VD på Holm AB",
      company: "Holm AB",
      profileUrl: "https://www.linkedin.com/in/erik-holm",
      signal: { kind: "post", url: "https://www.linkedin.com/posts/1", postedAt: "2026-11-14T08:00:00.000Z" },
    });

    const [url, init] = http.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/linkedin/search/posts?limit=25`);
    expect(init.method).toBe("POST");
    expect(init.headers["X-API-KEY"]).toBe("test-key");
    expect(JSON.parse(init.body)).toEqual({ keywords: "chattbot", sort_by: "DATE", date_posted: "PAST_WEEK" });
  });

  it("turns a checkpoint during search into a Swedish error", async () => {
    const http = vi.fn().mockResolvedValue(json({ object: "Error", type: "provider/unknown_authentication_context", status: 403 }, 403));
    const provider = new UnipileLinkedInProvider(config, http);
    await expect(provider.searchSignals(sampleWorkspace)).rejects.toMatchObject({
      userMessage: expect.stringContaining("bekräftar ditt konto"),
    });
  });
});

describe("UnipileLinkedInProvider.send", () => {
  it("looks up the profile and sends a relation request with the note", async () => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(profile("THIRD_DEGREE"))
      .mockResolvedValueOnce(json({ object: "RelationRequest", type: "sent", id: "r1" }, 201));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send(invite, sampleLeads[0]);

    expect(result).toEqual({ ok: true });
    expect(String(http.mock.calls[0][0])).toBe(`${BASE}/users/example-anna?variant=linkedin_classic`);
    expect(String(http.mock.calls[1][0])).toBe(`${BASE}/users/me/relation-requests`);
    expect(JSON.parse(http.mock.calls[1][1].body)).toEqual({ user_id: "ACo123", message: "Hej Anna!" });
  });

  it("does not invite someone with a pending request", async () => {
    const http = vi.fn().mockResolvedValueOnce(profile("SECOND_DEGREE", { relation_request_status: "PENDING" }));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send(invite, sampleLeads[0]);
    expect(result.ok).toBe(false);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it("sends a message to a first-degree connection", async () => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(profile("FIRST_DEGREE"))
      .mockResolvedValueOnce(json({ object: "ChatStarted", chat_id: "c1", message_id: "m1" }));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send({ ...invite, kind: "message", body: "Tack!" }, sampleLeads[0]);

    expect(result.ok).toBe(true);
    const [url, init] = http.mock.calls[1];
    expect(String(url)).toBe(`${BASE}/chats/send`);
    expect(JSON.parse(init.body)).toEqual({ users_ids: "ACo123", text: "Tack!" });
  });

  it("does not message people who are not connections", async () => {
    const http = vi.fn().mockResolvedValueOnce(profile("SECOND_DEGREE"));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send({ ...invite, kind: "follow_up" }, sampleLeads[0]);
    expect(result.ok).toBe(false);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, "provider/too_many_requests"],
    [403, "provider/unknown_authentication_context"],
    [401, "provider/invalid_authorization"],
    [422, "provider/cannot_resend_yet"],
    [502, "provider/server_error"],
  ])("asks the app to pause on %s %s", async (status, type) => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(profile("THIRD_DEGREE"))
      .mockResolvedValueOnce(json({ object: "Error", type, status }, status));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send(invite, sampleLeads[0]);
    expect(result.ok).toBe(false);
    expect(result.pauseReason).toBeTruthy();
  });

  it.each([
    [429, "api/too_many_requests"],
    [409, "provider/conflict"],
  ])("reports %s %s without pausing", async (status, type) => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(profile("THIRD_DEGREE"))
      .mockResolvedValueOnce(json({ object: "Error", type, status }, status));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send(invite, sampleLeads[0]);
    expect(result.ok).toBe(false);
    expect(result.pauseReason).toBeUndefined();
  });
});

describe("helpers", () => {
  it("extracts the public identifier from a profile URL", () => {
    expect(publicIdentifier("https://se.linkedin.com/in/Anna-Lindqvist-1a/?trk=x")).toBe("anna-lindqvist-1a");
    expect(publicIdentifier("https://example.se")).toBeNull();
  });
  it("guesses the company from a Swedish or English headline", () => {
    expect(companyFromHeadline("VD på Holm AB | Fastigheter")).toBe("Holm AB");
    expect(companyFromHeadline("CEO at Acme")).toBe("Acme");
    expect(companyFromHeadline("Konsult")).toBe("");
  });
  it("builds the profile URL from the public identifier when needed", () => {
    const signal = toRawSignal({ text: "hej", author: { type: "individual", display_name: "A B", public_identifier: "a-b" } });
    expect(signal?.profileUrl).toBe("https://www.linkedin.com/in/a-b");
  });
  it("skips posts without an author", () => {
    expect(toRawSignal({ text: "hej" })).toBeNull();
  });
});
