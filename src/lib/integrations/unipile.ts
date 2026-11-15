import { normalizeProfileUrl } from "../domain/normalize";
import type { Lead, OutreachItem, Workspace } from "../types";
import { INVITE_NOTE_MAX } from "./anthropic-ai";
import { IntegrationError } from "./errors";
import type { LinkedInProvider, RawSignal, SendResult } from "./types";

/**
 * LinkedIn through Unipile's v2 API (https://developer.unipile.com/v2.0).
 *
 * Endpoints used, as documented (account id in the path, auth via X-API-KEY):
 * - POST /v2/{account_id}/linkedin/search/posts            post search
 * - GET  /v2/{account_id}/users/{public_identifier}?variant=linkedin_classic
 * - POST /v2/{account_id}/users/me/relation-requests       { user_id, message }
 * - POST /v2/{account_id}/chats/send                       { users_ids, text }
 *
 * Nothing here tries to hide automation. Pacing and approval live in the app.
 */

export const DEFAULT_UNIPILE_BASE = "https://api.unipile.com/v2";

export interface UnipileConfig {
  apiKey: string;
  /** API base address; defaults to https://api.unipile.com/v2. */
  dsn: string;
  /** The linked LinkedIn account, "acc_…". */
  accountId: string;
}

/** Posts requested per keyword (documented range 1–49). */
export const MAX_POSTS_PER_KEYWORD = 25;
export const MAX_KEYWORDS_PER_SCAN = 8;

/** Error types that mean LinkedIn or the account connection needs attention. */
const PAUSE_TYPES = new Set([
  "provider/unknown_authentication_context",
  "provider/invalid_checkpoint_code",
  "provider/invalid_authorization",
  "provider/invalid_credentials",
  "provider/too_many_requests",
  "api/account_restricted",
]);

export class UnipileError extends Error {
  constructor(
    readonly status: number,
    readonly type: string | undefined,
  ) {
    super(`Unipile request failed (${status}${type ? ` ${type}` : ""})`);
    this.name = "UnipileError";
  }

  /** LinkedIn is limiting or blocking the account: stop sending until the user resumes. */
  get shouldPause(): boolean {
    const type = this.type ?? "";
    if (PAUSE_TYPES.has(type)) return true;
    if (type.includes("cannot_resend_yet")) return true;
    // Per Unipile, a provider 429 or 5xx means LinkedIn throttled the account.
    if (type.startsWith("provider/") && (this.status === 429 || this.status >= 500)) return true;
    return false;
  }
}

interface PostAuthor {
  type?: string;
  display_name?: string;
  public_identifier?: string;
  profile_url?: string;
  description?: string;
}

interface PostSearchItem {
  share_url?: string;
  created_at?: string;
  text?: string;
  author?: PostAuthor;
}

interface UserProfile {
  id?: string;
  specifics?: {
    network_distance?: string;
    relation_request_status?: string;
  };
}

/** Base address from UNIPILE_DSN; always ends in /v2, no trailing slash. */
export function baseUrl(dsn: string | undefined): string {
  let value = (dsn ?? "").trim().replace(/\/+$/, "");
  if (!value) return DEFAULT_UNIPILE_BASE;
  if (!/^https?:\/\//.test(value)) value = `https://${value}`;
  if (!/\/v2$/.test(value)) value = `${value}/v2`;
  return value;
}

/** Public identifier from a profile URL: linkedin.com/in/{id}. */
export function publicIdentifier(profileUrl: string): string | null {
  const match = normalizeProfileUrl(profileUrl).match(/linkedin\.com\/in\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Human-readable pause reason for a Unipile error. */
export function pauseMessage(error: UnipileError): string {
  const type = error.type ?? "";
  if (type === "provider/unknown_authentication_context" || type === "provider/invalid_checkpoint_code") {
    return "LinkedIn vill att du bekräftar ditt konto. Logga in på LinkedIn och följ instruktionerna, koppla sedan om kontot i Unipile.";
  }
  if (type === "provider/invalid_authorization" || type === "provider/invalid_credentials") {
    return "LinkedIn-kontot behöver kopplas om i Unipile. Gör det i Unipiles kontrollpanel.";
  }
  if (type === "api/account_restricted") {
    return "Unipile har spärrat LinkedIn-kontot. Kontrollera kontot i Unipiles kontrollpanel.";
  }
  if (type.includes("cannot_resend_yet")) {
    return "LinkedIn säger att gränsen för kontaktförfrågningar är nådd. Vänta minst ett dygn innan du återupptar.";
  }
  return "LinkedIn begränsar just nu hur mycket som kan skickas. Vänta några timmar innan du återupptar.";
}

function sendErrorMessage(error: UnipileError): string {
  const type = error.type ?? "";
  if (type === "api/too_many_requests") return "Unipile tar emot för många anrop just nu. Försök igen om en stund.";
  if (type === "provider/resource_not_found" || error.status === 404) return "Hittade inte personen eller LinkedIn-kontot i Unipile.";
  if (type === "provider/conflict") return "LinkedIn tog inte emot utskicket, troligen finns redan en förfrågan eller konversation.";
  if (type === "api/invalid_parameters") return "Unipile godtog inte uppgifterna. Kontrollera texten och försök igen.";
  if (error.status === 401 || error.status === 403) {
    return "Unipile godkände inte nyckeln. Kontrollera UNIPILE_API_KEY och UNIPILE_ACCOUNT_ID i .env.local.";
  }
  return `Unipile svarade med fel (${error.status}). Försök igen senare.`;
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
    const url = new URL(`${this.base}/${encodeURIComponent(this.config.accountId)}${path}`);
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
      // One page per keyword is enough for a daily scan and keeps volume low.
      const data = await this.request<{ data?: PostSearchItem[] }>("/linkedin/search/posts", {
        method: "POST",
        query: { limit: String(MAX_POSTS_PER_KEYWORD) },
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keywords: keyword, sort_by: "DATE", date_posted: "PAST_WEEK" }),
      });
      for (const item of data.data ?? []) {
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
    if (!id) throw new UnipileError(400, "api/invalid_parameters");
    return this.request<UserProfile>(`/users/${encodeURIComponent(id)}`, { query: { variant: "linkedin_classic" } });
  }

  async send(item: OutreachItem, lead: Lead): Promise<SendResult> {
    try {
      const profile = await this.profile(lead);
      if (!profile.id) return { ok: false, error: "Hittade inte personen på LinkedIn." };
      const connected = profile.specifics?.network_distance === "FIRST_DEGREE";

      if (item.kind === "invite") {
        if (connected) return { ok: false, error: "Ni är redan kontakter. Skicka ett meddelande i stället." };
        if (profile.specifics?.relation_request_status === "PENDING") {
          return { ok: false, error: "Det finns redan en obesvarad kontaktförfrågan till den här personen." };
        }
        await this.request("/users/me/relation-requests", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ user_id: profile.id, message: item.body.slice(0, INVITE_NOTE_MAX) }),
        });
        return { ok: true };
      }

      // Messages without InMail only go to existing connections.
      if (!connected) return { ok: false, error: "Ni är inte kontakter än. Skicka en kontaktförfrågan först." };
      await this.request("/chats/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ users_ids: profile.id, text: item.body }),
      });
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

/** Map a post search item to a signal. Company posts and posts without an author are skipped. */
export function toRawSignal(item: PostSearchItem): RawSignal | null {
  const author = item.author;
  if (!author || author.type !== "individual" || !author.display_name) return null;
  if (!item.text?.trim()) return null;
  const profileUrl =
    author.profile_url && /linkedin\.com\/in\//i.test(author.profile_url)
      ? author.profile_url
      : author.public_identifier
        ? `https://www.linkedin.com/in/${author.public_identifier}`
        : null;
  if (!profileUrl) return null;
  // The v2 author object has no headline field; "description" is the closest documented field.
  const headline = author.description?.trim() ?? "";
  return {
    fullName: author.display_name.trim(),
    headline,
    company: companyFromHeadline(headline),
    location: "",
    profileUrl,
    signal: {
      kind: "post",
      text: item.text.trim(),
      url: item.share_url ?? profileUrl,
      postedAt: item.created_at ?? new Date().toISOString(),
    },
  };
}

export function companyFromHeadline(headline: string): string {
  const match = headline.match(/\s(?:på|at|@)\s+([^|,·•]+)/i);
  return match ? match[1].trim() : "";
}
