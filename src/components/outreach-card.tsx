"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { outreachAction, type OutreachActionState } from "@/lib/actions/outreach";
import { outreachKindLabel, outreachStatusLabel } from "@/lib/labels";
import type { OutreachItem } from "@/lib/types";
import { Badge, Button, Card, Notice, inputClass } from "./ui";

/**
 * One pending item in the queue: edit the text, approve, then send.
 * Automated mode sends through LinkedIn; manual mode copies the text and opens
 * the profile so the user sends it, then records it as sent.
 */
export function OutreachCard({
  item,
  leadName,
  leadHeadline,
  profileUrl,
  quotaLeft,
  automated,
  maxLength,
}: {
  item: OutreachItem;
  leadName: string;
  leadHeadline: string;
  profileUrl: string;
  quotaLeft: number;
  automated: boolean;
  maxLength?: number;
}) {
  const [state, formAction, pending] = useActionState<OutreachActionState, FormData>(outreachAction, {});
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [length, setLength] = useState(item.body.length);
  const [copied, setCopied] = useState(false);
  const approved = item.status === "approved";
  const tooLong = maxLength !== undefined && length > maxLength;

  async function copyAndOpen() {
    const text = textRef.current?.value ?? item.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    window.open(profileUrl, "_blank", "noopener,noreferrer");
  }

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
          ref={textRef}
          name="body"
          defaultValue={item.body}
          key={item.body}
          onChange={(e) => setLength(e.target.value.length)}
          rows={3}
          className={inputClass}
        />
        {maxLength !== undefined && (
          <p className={tooLong ? "text-xs text-red-600 dark:text-red-400" : "text-xs text-muted"}>
            {length} / {maxLength} tecken{tooLong && " – för långt för en kontaktförfrågan"}
          </p>
        )}

        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.message && !state.error && <Notice tone="success">{state.message}</Notice>}
        {copied && !state.message && !state.error && (
          <Notice>Texten är kopierad och profilen öppnad. Skicka på LinkedIn och markera sedan som skickat.</Notice>
        )}

        <div className="flex flex-wrap gap-2">
          {!approved && (
            <Button type="submit" name="intent" value="approve" variant="primary" disabled={pending || tooLong}>
              Godkänn
            </Button>
          )}
          {approved && automated && (
            <Button type="submit" name="intent" value="send" variant="primary" disabled={pending || quotaLeft <= 0}>
              Skicka via LinkedIn
            </Button>
          )}
          {approved && !automated && (
            <>
              <Button type="button" variant="primary" onClick={copyAndOpen}>
                Kopiera och öppna profil
              </Button>
              <Button type="submit" name="intent" value="mark_sent" disabled={pending || quotaLeft <= 0}>
                Markera som skickat
              </Button>
            </>
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
