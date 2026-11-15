"use client";

import Link from "next/link";
import { useActionState } from "react";
import { outreachAction, type OutreachActionState } from "@/lib/actions/outreach";
import { outreachKindLabel, outreachStatusLabel } from "@/lib/labels";
import type { OutreachItem } from "@/lib/types";
import { Badge, Button, Card, Notice, inputClass } from "./ui";

/** One pending item in the queue: edit the text, approve, send or cancel. */
export function OutreachCard({
  item,
  leadName,
  leadHeadline,
  quotaLeft,
}: {
  item: OutreachItem;
  leadName: string;
  leadHeadline: string;
  quotaLeft: number;
}) {
  const [state, formAction, pending] = useActionState<OutreachActionState, FormData>(outreachAction, {});
  const approved = item.status === "approved";

  return (
    <Card>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={item.id} />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/leads/${item.leadId}`} className="font-medium hover:underline">
              {leadName}
            </Link>
            <p className="truncate text-sm text-muted">{leadHeadline}</p>
          </div>
          <div className="flex gap-2">
            <Badge>{outreachKindLabel[item.kind]}</Badge>
            <Badge tone={approved ? "success" : "accent"}>{outreachStatusLabel[item.status]}</Badge>
          </div>
        </div>

        <label htmlFor={`body-${item.id}`} className="sr-only">
          Text
        </label>
        <textarea
          id={`body-${item.id}`}
          name="body"
          defaultValue={item.body}
          key={item.body}
          rows={3}
          className={inputClass}
        />

        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.message && !state.error && <Notice tone="success">{state.message}</Notice>}

        <div className="flex flex-wrap gap-2">
          {approved ? (
            <Button type="submit" name="intent" value="send" variant="primary" disabled={pending || quotaLeft <= 0}>
              Skicka
            </Button>
          ) : (
            <Button type="submit" name="intent" value="approve" variant="primary" disabled={pending}>
              Godkänn
            </Button>
          )}
          <Button type="submit" name="intent" value="save" disabled={pending}>
            Spara text
          </Button>
          <Button type="submit" name="intent" value="cancel" variant="ghost" disabled={pending}>
            Avbryt utskick
          </Button>
          {approved && quotaLeft <= 0 && <span className="self-center text-xs text-muted">Dagens gräns är nådd.</span>}
        </div>
      </form>
    </Card>
  );
}
