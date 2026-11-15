"use client";

import { useActionState } from "react";
import { saveSendingSettings, type SendingFormState } from "@/lib/actions/sending";
import type { SendingSettings } from "@/lib/types";
import { Button, Notice, inputClass } from "./ui";

const hours = Array.from({ length: 25 }, (_, h) => h);

export function SendingForm({ initial, maxInvites, maxMessages }: { initial: SendingSettings; maxInvites: number; maxMessages: number }) {
  const [state, action, pending] = useActionState<SendingFormState, FormData>(saveSendingSettings, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="invitesPerDay" className="block text-sm font-medium">
            Kontaktförfrågningar per dag
          </label>
          <input id="invitesPerDay" name="invitesPerDay" type="number" min={0} max={maxInvites} defaultValue={initial.invitesPerDay} className={inputClass} />
          <p className="text-xs text-muted">Högst {maxInvites}.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="messagesPerDay" className="block text-sm font-medium">
            Meddelanden och uppföljningar per dag
          </label>
          <input id="messagesPerDay" name="messagesPerDay" type="number" min={0} max={maxMessages} defaultValue={initial.messagesPerDay} className={inputClass} />
          <p className="text-xs text-muted">Högst {maxMessages}.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="startHour" className="block text-sm font-medium">
            Skicka från
          </label>
          <select id="startHour" name="startHour" defaultValue={initial.startHour} className={inputClass}>
            {hours.slice(0, 24).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="endHour" className="block text-sm font-medium">
            Skicka till
          </label>
          <select id="endHour" name="endHour" defaultValue={initial.endHour} className={inputClass}>
            {hours.slice(1).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="weekdaysOnly" defaultChecked={initial.weekdaysOnly} className="mt-0.5" />
        <span>Bara vardagar</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="rampUp" defaultChecked={initial.rampUp} className="mt-0.5" />
        <span>
          Börja försiktigt
          <span className="block text-xs text-muted">
            De första två veckorna börjar vi på 5 kontaktförfrågningar om dagen och ökar sedan gradvis.
          </span>
        </span>
      </label>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && !state.error && <Notice tone="success">{state.message}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sparar…" : "Spara utskickstakt"}
        </Button>
      </div>
    </form>
  );
}
