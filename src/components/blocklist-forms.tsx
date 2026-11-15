"use client";

import { useActionState } from "react";
import { addBlockEntry, createRemovalRequest, importLeadsCsv, type FormState } from "@/lib/actions/blocklist";
import { Button, Notice, inputClass } from "./ui";

function Result({ state }: { state: FormState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function AddBlockForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addBlockEntry, {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="block-kind" className="sr-only">
          Typ
        </label>
        <select id="block-kind" name="kind" defaultValue="profile" className={`${inputClass} sm:w-36`}>
          <option value="profile">Profil</option>
          <option value="company">Företag</option>
        </select>
        <label htmlFor="block-value" className="sr-only">
          Profiladress eller företagsnamn
        </label>
        <input
          id="block-value"
          name="value"
          placeholder="linkedin.com/in/namn eller Företaget AB"
          className={inputClass}
          required
        />
        <Button type="submit" variant="primary" disabled={pending} className="shrink-0">
          Spärra
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function RemovalRequestForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createRemovalRequest, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="rem-url" className="mb-1 block text-xs font-medium text-muted">
            Profiladress
          </label>
          <input id="rem-url" name="profileUrl" placeholder="linkedin.com/in/namn" className={inputClass} required />
        </div>
        <div>
          <label htmlFor="rem-name" className="mb-1 block text-xs font-medium text-muted">
            Namn (valfritt)
          </label>
          <input id="rem-name" name="fullName" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="rem-note" className="mb-1 block text-xs font-medium text-muted">
          Anteckning (valfritt)
        </label>
        <input id="rem-note" name="note" placeholder="Till exempel: begäran via mejl" className={inputClass} />
      </div>
      <Result state={state} />
      <Button type="submit" variant="danger" disabled={pending}>
        Radera personens uppgifter
      </Button>
    </form>
  );
}

export function CsvImportForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(importLeadsCsv, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="csv-file" className="mb-1 block text-xs font-medium text-muted">
          CSV-fil
        </label>
        <input
          id="csv-file"
          name="file"
          type="file"
          accept=".csv,text/csv,text/plain"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm"
        />
      </div>
      <div>
        <label htmlFor="csv-text" className="mb-1 block text-xs font-medium text-muted">
          Eller klistra in profiladresser
        </label>
        <textarea id="csv-text" name="text" rows={3} placeholder="https://www.linkedin.com/in/namn" className={inputClass} />
      </div>
      <Result state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Importerar…" : "Importera"}
      </Button>
    </form>
  );
}
