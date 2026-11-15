import { describe, expect, it } from "vitest";
import { extractProfileUrls, nameFromProfileUrl, parseKeywords } from "./normalize";

describe("CSV profile extraction", () => {
  it("finds profile URLs in CSV rows and removes duplicates", () => {
    const csv = [
      "namn,profil",
      "Anna,https://www.linkedin.com/in/anna-lindqvist/",
      "Anna igen,linkedin.com/in/anna-lindqvist?trk=x",
      'Johan,"https://se.linkedin.com/in/johan-berg-1a2b"',
      "Ingen profil,https://example.se",
    ].join("\n");
    expect(extractProfileUrls(csv)).toEqual([
      "https://www.linkedin.com/in/anna-lindqvist",
      "https://www.linkedin.com/in/johan-berg-1a2b",
    ]);
  });

  it("makes a readable placeholder name from the URL", () => {
    expect(nameFromProfileUrl("https://www.linkedin.com/in/johan-berg-1a2b")).toBe("Johan Berg");
    expect(nameFromProfileUrl("https://www.linkedin.com/in/123")).toBe("Okänd person");
  });
});

describe("keywords", () => {
  it("splits on commas and new lines, trims and de-duplicates", () => {
    expect(parseKeywords("AI, chattbot\nai ,  , Kundtjänst")).toEqual(["AI", "chattbot", "Kundtjänst"]);
  });
});
