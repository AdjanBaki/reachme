import { describe, expect, it, vi } from "vitest";
import { sampleLeads, sampleWorkspace } from "../sample-data";
import type { OutreachItem } from "../types";
import { UnipileLinkedInProvider, companyFromHeadline, publicIdentifier, toRawSignal } from "./unipile";

const config = { apiKey: "test-key", dsn: "api1.unipile.com:13111", accountId: "acc_1" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const invite: OutreachItem = {
  id: "o1",
  leadId: "lead_1",
  kind: "invite",
  body: "Hej Anna!",
  status: "approved",
  createdAt: "2026-11-15T05:00:00Z",
};

describe("UnipileLinkedInProvider.searchSignals", () => {
  it("searches recent posts per keyword and maps authors", async () => {
    const http = vi.fn().mockResolvedValue(
      json({
        object: "LinkedinSearch",
        items: [
          {
            type: "POST",
            share_url: "https://www.linkedin.com/posts/1",
            parsed_datetime: "2026-11-14T08:00:00.000Z",
            text: "Någon som testat en chattbot på svenska?",
            author: { name: "Erik Holm", public_identifier: "erik-holm", headline: "VD på Holm AB", is_company: false },
          },
          { type: "POST", text: "Företagsinlägg", author: { name: "Firma", public_identifier: "firma", is_company: true } },
        ],
      }),
    );
    const provider = new UnipileLinkedInProvider(config, http);
    const signals = await provider.searchSignals({ ...sampleWorkspace, keywords: ["chattbot"] });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      fullName: "Erik Holm",
      company: "Holm AB",
      profileUrl: "https://www.linkedin.com/in/erik-holm",
      signal: { kind: "post", url: "https://www.linkedin.com/posts/1", postedAt: "2026-11-14T08:00:00.000Z" },
    });

    const [url, init] = http.mock.calls[0];
    expect(String(url)).toBe("https://api1.unipile.com:13111/api/v1/linkedin/search?account_id=acc_1");
    expect(init.method).toBe("POST");
    expect(init.headers["X-API-KEY"]).toBe("test-key");
    expect(JSON.parse(init.body)).toMatchObject({ api: "classic", category: "posts", keywords: "chattbot", date_posted: "past_week" });
  });

  it("turns a restriction during search into a Swedish error", async () => {
    const http = vi.fn().mockResolvedValue(json({ type: "errors/account_restricted" }, 403));
    const provider = new UnipileLinkedInProvider(config, http);
    await expect(provider.searchSignals(sampleWorkspace)).rejects.toMatchObject({
      userMessage: expect.stringContaining("begränsat"),
    });
  });
});

describe("UnipileLinkedInProvider.send", () => {
  it("looks up the profile and sends an invite with the note", async () => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(json({ provider_id: "ACo123", is_relationship: false }))
      .mockResolvedValueOnce(json({ object: "UserInvitationSent", invitation_id: "inv1" }));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send(invite, sampleLeads[0]);

    expect(result).toEqual({ ok: true });
    expect(String(http.mock.calls[0][0])).toBe("https://api1.unipile.com:13111/api/v1/users/example-anna?account_id=acc_1");
    expect(String(http.mock.calls[1][0])).toBe("https://api1.unipile.com:13111/api/v1/users/invite");
    expect(JSON.parse(http.mock.calls[1][1].body)).toEqual({ provider_id: "ACo123", account_id: "acc_1", message: "Hej Anna!" });
  });

  it("sends a message to an existing connection as a new chat", async () => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(json({ provider_id: "ACo123", is_relationship: true }))
      .mockResolvedValueOnce(json({ object: "ChatStarted", chat_id: "c1" }));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send({ ...invite, kind: "message", body: "Tack!" }, sampleLeads[0]);

    expect(result.ok).toBe(true);
    const [url, init] = http.mock.calls[1];
    expect(String(url)).toBe("https://api1.unipile.com:13111/api/v1/chats");
    const form = init.body as FormData;
    expect(form.get("attendees_ids")).toBe("ACo123");
    expect(form.get("text")).toBe("Tack!");
  });

  it("does not message people who are not connections", async () => {
    const http = vi.fn().mockResolvedValueOnce(json({ provider_id: "ACo123", is_relationship: false }));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send({ ...invite, kind: "follow_up" }, sampleLeads[0]);
    expect(result.ok).toBe(false);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each([
    [422, "errors/cannot_resend_yet"],
    [401, "errors/checkpoint_error"],
    [403, "errors/account_restricted"],
    [429, "errors/too_many_requests"],
  ])("asks the app to pause on %s %s", async (status, type) => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(json({ provider_id: "ACo123", is_relationship: false }))
      .mockResolvedValueOnce(json({ type }, status));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send(invite, sampleLeads[0]);
    expect(result.ok).toBe(false);
    expect(result.pauseReason).toBeTruthy();
  });

  it("reports ordinary errors without pausing", async () => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(json({ provider_id: "ACo123", is_relationship: false }))
      .mockResolvedValueOnce(json({ type: "errors/already_invited_recently" }, 422));
    const provider = new UnipileLinkedInProvider(config, http);
    const result = await provider.send(invite, sampleLeads[0]);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("nyligen") });
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
  it("skips posts without an author", () => {
    expect(toRawSignal({ text: "hej" })).toBeNull();
  });
});
