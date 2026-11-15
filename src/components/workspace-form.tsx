"use client";

import { useActionState, useState, useTransition } from "react";
import { analyzeWebsite, saveWorkspace, type SaveWorkspaceState } from "@/lib/actions/workspace";
import type { Workspace } from "@/lib/types";
import { Button, Notice, inputClass } from "./ui";

const hours = Array.from({ length: 24 }, (_, h) => h);

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Workspace profile form used both in onboarding (/kom-igang) and settings.
 * The website can be analyzed to prefill offer, ideal customer and keywords.
 */
export function WorkspaceForm({ initial, mode }: { initial: Workspace; mode: "onboarding" | "settings" }) {
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl);
  const [offer, setOffer] = useState(initial.offer);
  const [idealCustomer, setIdealCustomer] = useState(initial.idealCustomer);
  const [keywords, setKeywords] = useState(initial.keywords.join(", "));
  const [analyzeMessage, setAnalyzeMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [state, formAction, saving] = useActionState<SaveWorkspaceState, FormData>(saveWorkspace, {});

  function onAnalyze() {
    setAnalyzeMessage(null);
    startAnalyze(async () => {
      const result = await analyzeWebsite(websiteUrl);
      if (!result.ok) {
        setAnalyzeMessage({ tone: "danger", text: result.error });
        return;
      }
      setOffer(result.profile.offer);
      setIdealCustomer(result.profile.idealCustomer);
      if (result.profile.keywords.length > 0) setKeywords(result.profile.keywords.join(", "));
      setAnalyzeMessage({ tone: "success", text: "Förslag inlagt. Läs igenom och justera innan du sparar." });
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {mode === "onboarding" && <input type="hidden" name="redirectTo" value="/leads" />}

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{mode === "onboarding" ? "1. Er webbplats" : "Företag"}</h2>
        <Field label="Företagets namn" htmlFor="name">
          <input id="name" name="name" defaultValue={initial.name} required className={inputClass} />
        </Field>
        <Field
          label="Webbplats"
          htmlFor="websiteUrl"
          hint="Vi läser webbplatsen och föreslår erbjudande, idealkund och sökord."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="websiteUrl"
              name="websiteUrl"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="foretaget.se"
              required
              className={inputClass}
            />
            <Button type="button" onClick={onAnalyze} disabled={analyzing || !websiteUrl.trim()} className="shrink-0">
              {analyzing ? "Analyserar…" : "Analysera webbplatsen"}
            </Button>
          </div>
        </Field>
        {analyzeMessage && <Notice tone={analyzeMessage.tone}>{analyzeMessage.text}</Notice>}
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{mode === "onboarding" ? "2. Vem ni vill nå" : "Målgrupp"}</h2>
        <Field label="Vad ni säljer" htmlFor="offer">
          <textarea id="offer" name="offer" rows={3} value={offer} onChange={(e) => setOffer(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Er idealkund" htmlFor="idealCustomer" hint="Roll, bransch, storlek och region.">
          <textarea
            id="idealCustomer"
            name="idealCustomer"
            rows={2}
            value={idealCustomer}
            onChange={(e) => setIdealCustomer(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Sökord" htmlFor="keywords" hint="Separera med kommatecken. Vi letar efter inlägg och kommentarer som nämner dem.">
          <textarea id="keywords" name="keywords" rows={2} value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputClass} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{mode === "onboarding" ? "3. Daglig sökning" : "Daglig sökning"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tid för sökningen" htmlFor="scanHour" hint="Svensk tid. Nya leads finns klara efter sökningen.">
            <select id="scanHour" name="scanHour" defaultValue={initial.scanHour} className={inputClass}>
              {hours.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lägsta matchning (%)" htmlFor="minFitScore" hint="Leads under gränsen visas inte.">
            <input
              id="minFitScore"
              name="minFitScore"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={initial.minFitScore}
              required
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.saved && <Notice tone="success">Inställningarna är sparade.</Notice>}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Sparar…" : mode === "onboarding" ? "Spara och visa leads" : "Spara"}
        </Button>
      </div>
    </form>
  );
}
