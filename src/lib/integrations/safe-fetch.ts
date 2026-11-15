import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { IntegrationError } from "./errors";

/**
 * Fetches a public web page server-side for website analysis.
 * Guards against SSRF: http/https only, no private, loopback or link-local
 * addresses (checked on every redirect), a timeout and a size cap.
 */

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_BYTES = 1_000_000;
export const MAX_TEXT_CHARS = 20_000;
const MAX_REDIRECTS = 3;

export interface SafeFetchDeps {
  fetch: typeof fetch;
  resolve: (hostname: string) => Promise<string[]>;
}

const defaultDeps: SafeFetchDeps = {
  fetch: (...args) => fetch(...args),
  resolve: async (hostname) => (await lookup(hostname, { all: true })).map((a) => a.address),
};

/** True for addresses that must never be fetched from the server. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const v = address.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true;
}

async function assertPublicUrl(url: URL, deps: SafeFetchDeps): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new IntegrationError("Bara webbadresser som börjar med http eller https kan analyseras.");
  }
  if (url.username || url.password) throw new IntegrationError("Webbadressen får inte innehålla inloggningsuppgifter.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new IntegrationError("Den webbadressen går inte att analysera.");
  }
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await deps.resolve(host);
  } catch (cause) {
    throw new IntegrationError("Hittade inte webbplatsen. Kontrollera adressen.", { cause });
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new IntegrationError("Den webbadressen går inte att analysera.");
  }
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - offset);
    bytes.set(part, offset);
    offset += part.length;
    if (offset >= bytes.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Reduce HTML to readable text: drop scripts, styles and tags, keep the title and meta description. */
export function htmlToText(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1] ??
    "";
  const body = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|h[1-6]|section|article|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = [title, description, body]
    .join("\n")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
      if (code.startsWith("#x")) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text.slice(0, MAX_TEXT_CHARS);
}

/** Fetch a public page and return its readable text. */
export async function fetchPageText(rawUrl: string, deps: SafeFetchDeps = defaultDeps): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new IntegrationError("Ogiltig webbadress.");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url, deps);
    let response: Response;
    try {
      response = await deps.fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": "ReachMe/1.0 (website analysis)", accept: "text/html,text/plain" },
      });
    } catch (cause) {
      throw new IntegrationError("Kunde inte hämta webbplatsen. Kontrollera adressen eller försök igen.", { cause });
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new IntegrationError(`Webbplatsen svarade med fel (${response.status}).`);

    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      throw new IntegrationError("Adressen pekar inte på en vanlig webbsida.");
    }
    const raw = await readCapped(response);
    const text = /html/i.test(type) || /<html|<body/i.test(raw) ? htmlToText(raw) : raw.slice(0, MAX_TEXT_CHARS);
    if (text.length < 40) throw new IntegrationError("Hittade för lite text på webbplatsen för att analysera den.");
    return text;
  }
  throw new IntegrationError("Webbplatsen skickade vidare för många gånger.");
}
