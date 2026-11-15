import { normalizeProfileUrl } from "../domain/normalize";
import type { Lead, OutreachItem, Workspace } from "../types";
import { INVITE_NOTE_MAX } from "./anthropic-ai";
import { IntegrationError } from "./errors";
import type { LinkedInProvider, RawSignal, SendResult } from "./types";

/**
 * LinkedIn through Unipile (https://developer.unipile.com).
 *
 * Endpoints used, as documented:
 * - POST /api/v1/linkedin/search?account_id=…  (api "classic", category "posts")
 * - GET  /api/v1/users/{public_identifier}?account_id=…  (provider_id, is_relationship)
 * - POST /api/v1/users/invite  { provider_id, account_id, message }
 * - POST /api/v1/chats  multipart { account_id, attendees_ids, text }
 *
 * Nothing here tries to hide automation. Pacing and approval live in the app.
 */

export interface UnipileConfig {
  apiKey: string;
  dsn: string;
  accountId: string;
}

/** Max posts read per keyword in one scan, to stay well under search limits. */
export const MAX_POSTS_PER_KEYWORD = 25;
export const MAX_KEYWORDS_PER_SCAN = 8;

/** Unipile error types that mean LinkedIn is limiting or blocking the account. */
const PAUSE_TYPES = new Set([
  "errors/checkpoint_error",
  "errors/account_restricted",
  "errors/disconnected_account",
  "errors/invalid_credentials",
  "errors/expired_credentials",
  "errors/too_many_requests",
  "errors/cannot_resend_yet",
  "errors/limit_exceeded",
  "errors/connection_limit_reached",
  "errors/provider_error",
]);

export class UnipileError extends Error {
  constructor(
    readonly status: number,
    readonly type: string | undefined,
  ) {
    super(`Unipile request failed (${status}${type ? ` ${type}` : ""})`);
    this.name = "UnipileError";
  }

  /** LinkedIn is limiting the account: stop sending until the user resumes. */
  get shouldPause(): boolean {
    return this.status === 429 || (this.type !== undefined && PAUSE_TYPES.has(this.type));
  }
}

interface SearchPostItem {
  type?: string;
  share_url?: string;
  parsed_datetime?: string;
  text?: string;
  author?: { name?: string; public_identifier?: string; headline?: string; is_company?: boolean };
}

interface UserProfile {
  provider_id?: string;
  public_identifier?: string;
  is_relationship?: boolean;
}

function baseUrl(dsn: string): string {
  const trimmed = dsn.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Public identifier from a profile URL: linkedin.com/in/{id}. */
export function publicIdentifier(profileUrl: string): string | null {
  const match = normalizeProfileUrl(profileUrl).match(/linkedin\.com\/in\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Human-readable pause reason for a Unipile error type. */
export function pauseMessage(error: UnipileError): string {
  switch (error.type) {
    case "errors/checkpoint_error":
      return "LinkedIn vill att du bekräftar ditt konto (checkpoint). Logga in på LinkedIn och följ instruktionerna, koppla sedan om kontot i Unipile.";
    case "errors/account_restricted":
      return "LinkedIn har begränsat ditt konto. Pausa all automatik och kontrollera kontot på LinkedIn.";
    case "errors/disconnected_account":
    case "errors/invalid_credentials":
    case "errors/expired_credentials":
      return "LinkedIn-kontot är inte längre kopplat i Unipile. Koppla om kontot i Unipiles kontrollpanel.";
    case "errors/cannot_resend_yet":
    case "errors/limit_exceeded":
    case "errors/connection_limit_reached":
      return "LinkedIn säger att gränsen för kontaktförfrågningar är nådd. Vänta minst ett dygn innan du återupptar.";
    default:
      return "LinkedIn begränsar just nu hur mycket som kan skickas. Vänta några timmar innan du återupptar.";
  }
}

export class UnipileLinkedInProvider implements LinkedInProvider {
  readonly automated = true;
  private readonly base: string;

  constructor(
    private readonly config: UnipileConfig,
    private readonly http: typeof fetch = (...args) => fetch(...args),
  ) {
    this.base = baseUrl(config.dsn);
  }

  private async request<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
    const url = new URL(`${this.base}/api/v1${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
    const response = await this.http(url, {
      ...init,
      headers: { "X-API-KEY": this.config.apiKey, accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      let type: string | undefined;
      try {
        const body = (await response.json()) as { type?: unknown };
        if (typeof body.type === "string") type = body.type;
      } catch {
        // Body is not JSON; the status code is enough.
      }
      throw new UnipileError(response.status, type);
    }
    return (await response.json()) as T;
  }

  async searchSignals(workspace: Workspace): Promise<RawSignal[]> {
    try {
      return await this.search(workspace);
    } catch (error) {
      if (error instanceof UnipileError) {
        throw new IntegrationError(error.shouldPause ? pauseMessage(error) : sendErrorMessage(error), { cause: error });
      }
      throw new IntegrationError("Kunde inte nå Unipile. Kontrollera internetanslutningen och försök igen.", { cause: error });
    }
  }

  private async search(workspace: Workspace): Promise<RawSignal[]> {
    const results: RawSignal[] = [];
    const seen = new Set<string>();
    for (const keyword of workspace.keywords.slice(0, MAX_KEYWORDS_PER_SCAN)) {
      // Only the first page is read. Unipile's docs do not say how to send the
      // cursor back for post searches, and one page per keyword is plenty.
      const data = await this.request<{ items?: SearchPostItem[] }>("/linkedin/search", {
        method: "POST",
        query: { account_id: this.config.accountId },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api: "classic",
          category: "posts",
          keywords: keyword,
          sort_by: "date",
          date_posted: "past_week",
        }),
      });
      for (const item of (data.items ?? []).slice(0, MAX_POSTS_PER_KEYWORD)) {
        const signal = toRawSignal(item);
        if (!signal) continue;
        const key = signal.signal?.url ?? signal.profileUrl;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(signal);
      }
    }
    return results;
  }

  private async profile(lead: Lead): Promise<UserProfile> {
    const id = publicIdentifier(lead.profileUrl);
    if (!id) throw new UnipileError(400, "errors/invalid_parameters");
    return this.request<UserProfile>(`/users/${encodeURIComponent(id)}`, {
      query: { account_id: this.config.accountId },
    });
  }

  async send(item: OutreachItem, lead: Lead): Promise<SendResult> {
    try {
      const profile = await this.profile(lead);
      if (!profile.provider_id) return { ok: false, error: "Hittade inte personen på LinkedIn." };

      if (item.kind === "invite") {
        if (profile.is_relationship) return { ok: false, error: "Ni är redan kontakter. Skicka ett meddelande i stället." };
        await this.request("/users/invite", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider_id: profile.provider_id,
            account_id: this.config.accountId,
            message: item.body.slice(0, INVITE_NOTE_MAX),
          }),
        });
        return { ok: true };
      }

      // Messages without InMail can only go to existing connections.
      if (!profile.is_relationship) {
        return { ok: false, error: "Ni är inte kontakter än. Skicka en kontaktförfrågan först." };
      }
      const form = new FormData();
      form.set("account_id", this.config.accountId);
      form.set("attendees_ids", profile.provider_id);
      form.set("text", item.body);
      await this.request("/chats", { method: "POST", body: form });
      return { ok: true };
    } catch (error) {
      if (error instanceof UnipileError) {
        if (error.shouldPause) return { ok: false, error: pauseMessage(error), pauseReason: pauseMessage(error) };
        return { ok: false, error: sendErrorMessage(error) };
      }
      return { ok: false, error: "Kunde inte nå Unipile. Kontrollera internetanslutningen och försök igen." };
    }
  }
}

function sendErrorMessage(error: UnipileError): string {
  switch (error.type) {
    case "errors/already_invited_recently":
      return "En kontaktförfrågan skickades nyligen till den här personen.";
    case "errors/already_connected":
      return "Ni är redan kontakter. Skicka ett meddelande i stället.";
    case "errors/cannot_invite_attendee":
    case "errors/invalid_recipient":
      return "LinkedIn tillåter inte en kontaktförfrågan till den här personen.";
    case "errors/too_many_characters":
      return "Texten är för lång för LinkedIn. Korta ner den.";
    case "errors/resource_not_found":
    case "errors/invalid_resource_identifier":
      return "Hittade inte personen eller LinkedIn-kontot i Unipile.";
    default:
      return error.status === 401 || error.status === 403
        ? "Unipile godkände inte nyckeln. Kontrollera UNIPILE_API_KEY och UNIPILE_ACCOUNT_ID i .env.local."
        : `Unipile svarade med fel (${error.status}). Försök igen senare.`;
  }
}

/** Map a post search item to a signal. Company posts and posts without an author are skipped. */
export function toRawSignal(item: SearchPostItem): RawSignal | null {
  const author = item.author;
  if (!author?.public_identifier || !author.name || author.is_company) return null;
  if (!item.text?.trim()) return null;
  const profileUrl = `https://www.linkedin.com/in/${author.public_identifier}`;
  const headline = author.headline?.trim() ?? "";
  return {
    fullName: author.name.trim(),
    headline,
    // Post results do not include company or location; the company is guessed
    // from a headline like "VD på Företaget AB" and location is left empty.
    company: companyFromHeadline(headline),
    location: "",
    profileUrl,
    signal: {
      kind: "post",
      text: item.text.trim(),
      url: item.share_url ?? profileUrl,
      postedAt: item.parsed_datetime ?? new Date().toISOString(),
    },
  };
}

export function companyFromHeadline(headline: string): string {
  const match = headline.match(/\s(?:på|at|@)\s+([^|,·•]+)/i);
  return match ? match[1].trim() : "";
}
