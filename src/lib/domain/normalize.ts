/**
 * Normalize a LinkedIn profile URL so the same person matches regardless of
 * protocol, "www.", query string, trailing slash or letter case.
 */
export function normalizeProfileUrl(url: string): string {
  let value = url.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  value = value.split(/[?#]/)[0];
  value = value.replace(/\/+$/, "");
  return value;
}

/** Normalize a company name: case, whitespace and a trailing "AB" are ignored. */
export function normalizeCompany(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+\(?(ab|aktiebolag)\)?\.?$/, "")
    .trim();
}

/** Find LinkedIn profile URLs (linkedin.com/in/...) in free text or CSV. */
export function extractProfileUrls(text: string): string[] {
  const matches = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s,;"'<>]+/gi) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of matches) {
    const key = normalizeProfileUrl(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(`https://www.${key.replace(/^[a-z]{2,3}\.linkedin/, "linkedin")}`);
  }
  return result;
}

/** Turn "anna-lindqvist-12ab" into "Anna Lindqvist" as a placeholder name. */
export function nameFromProfileUrl(url: string): string {
  const slug = normalizeProfileUrl(url).split("/in/")[1] ?? "";
  const words = slug
    .split("-")
    .filter((w) => w && !/\d/.test(w));
  if (words.length === 0) return "Okänd person";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Split comma- or newline-separated keywords, trimmed and de-duplicated (max 30). */
export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const keyword = part.trim();
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
  }
  return result.slice(0, 30);
}
