import { describe, expect, it, vi } from "vitest";
import { IntegrationError } from "./errors";
import { fetchPageText, htmlToText, isPrivateAddress } from "./safe-fetch";

function htmlResponse(html: string, init: ResponseInit = {}) {
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
}

const page = "<html><head><title>Demobyrån</title><script>alert(1)</script></head><body><p>Vi hjälper svenska tjänsteföretag med AI-automation och chattbotar.</p></body></html>";

describe("isPrivateAddress", () => {
  it("rejects loopback, private, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });
  it("allows public addresses", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("2606:2800:220:1::")).toBe(false);
  });
});

describe("fetchPageText", () => {
  it("returns readable text without scripts", async () => {
    const deps = { fetch: vi.fn().mockResolvedValue(htmlResponse(page)), resolve: vi.fn().mockResolvedValue(["93.184.216.34"]) };
    const text = await fetchPageText("https://example.se", deps);
    expect(text).toContain("Demobyrån");
    expect(text).toContain("AI-automation");
    expect(text).not.toContain("alert");
  });

  it("refuses non-http protocols", async () => {
    const deps = { fetch: vi.fn(), resolve: vi.fn() };
    await expect(fetchPageText("file:///etc/passwd", deps)).rejects.toBeInstanceOf(IntegrationError);
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it("refuses hosts that resolve to private addresses", async () => {
    const deps = { fetch: vi.fn(), resolve: vi.fn().mockResolvedValue(["10.0.0.5"]) };
    await expect(fetchPageText("https://intranet.example.se", deps)).rejects.toBeInstanceOf(IntegrationError);
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it("checks redirect targets too", async () => {
    const redirect = new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
    const deps = { fetch: vi.fn().mockResolvedValue(redirect), resolve: vi.fn().mockResolvedValue(["93.184.216.34"]) };
    await expect(fetchPageText("https://example.se", deps)).rejects.toBeInstanceOf(IntegrationError);
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses non-HTML content", async () => {
    const pdf = new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } });
    const deps = { fetch: vi.fn().mockResolvedValue(pdf), resolve: vi.fn().mockResolvedValue(["93.184.216.34"]) };
    await expect(fetchPageText("https://example.se/a.pdf", deps)).rejects.toBeInstanceOf(IntegrationError);
  });
});

describe("htmlToText", () => {
  it("decodes entities and keeps the meta description", () => {
    const text = htmlToText('<meta name="description" content="Chattbotar &amp; AI"><p>F&ouml;retag &#229;r</p>');
    expect(text).toContain("Chattbotar & AI");
    expect(text).toContain("år");
  });
});
