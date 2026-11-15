"use client";

import { useActionState } from "react";
import { draftOutreach, type OutreachActionState } from "@/lib/actions/outreach";
import { Button, Notice } from "./ui";

/** Buttons on the lead page that ask the AI for a draft. */
export function DraftButtons({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<OutreachActionState, FormData>(draftOutreach, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">{pending ? "Skriver utkast…" : "Skriv utkast:"}</span>
        <Button type="submit" name="kind" value="invite" disabled={pending}>
          Kontaktförfrågan
        </Button>
        <Button type="submit" name="kind" value="message" disabled={pending}>
          Meddelande
        </Button>
        <Button type="submit" name="kind" value="follow_up" disabled={pending}>
          Uppföljning
        </Button>
      </div>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && !state.error && <Notice tone="success">{state.message}</Notice>}
    </form>
  );
}
