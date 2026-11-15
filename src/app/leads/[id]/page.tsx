import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, Button, Card, Loading, ScoreBadge, inputClass } from "@/components/ui";
import { lookupLeadContact, markLeadNotRelevant, setLeadOutcome } from "@/lib/actions/leads";
import { draftOutreach } from "@/lib/actions/outreach";
import { isBlocked, isSuppressed } from "@/lib/domain/filters";
import {
  formatDateTime,
  outcomeLabel,
  outcomeOrder,
  outreachKindLabel,
  outreachStatusLabel,
  signalLabel,
} from "@/lib/labels";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Lead" };

async function LeadDetail({ params }: { params: PageProps<"/leads/[id]">["params"] }) {
  const { id } = await params;
  const store = await getStore();
  const [lead, blockList, removals, outreach] = await Promise.all([
    store.getLead(id),
    store.listBlockList(),
    store.listRemovalRequests(),
    store.listOutreach(),
  ]);
  if (!lead || isBlocked(lead, blockList) || isSuppressed(lead.profileUrl, removals)) notFound();

  const items = outreach
    .filter((o) => o.leadId === lead.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.fullName}</h1>
          <p className="mt-1 text-sm text-muted">
            {lead.headline}
            {lead.company && ` · ${lead.company}`}
            {lead.location && ` · ${lead.location}`}
          </p>
          <a href={lead.profileUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-accent hover:underline">
            Öppna profilen på LinkedIn
          </a>
        </div>
        {lead.source === "import" ? <Badge>Importerad</Badge> : <ScoreBadge score={lead.fitScore} />}
      </div>

      {lead.signal ? (
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge>{signalLabel[lead.signal.kind]}</Badge>
            <span>{formatDateTime(lead.signal.postedAt)}</span>
          </div>
          <blockquote className="border-l-2 border-border pl-3 text-sm">{lead.signal.text}</blockquote>
          <a href={lead.signal.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-muted hover:underline">
            Visa på LinkedIn
          </a>
        </Card>
      ) : (
        <Card className="text-sm text-muted">Importerad från CSV. Ingen köpsignal är kopplad till personen än.</Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Varför personen matchar</h2>
          <p className="text-sm">{lead.fitReason || "Ingen motivering än."}</p>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Kontaktuppgifter</h2>
          {lead.contact && (lead.contact.email || lead.contact.phone) ? (
            <dl className="space-y-1 text-sm">
              {lead.contact.email && (
                <div className="flex gap-2">
                  <dt className="text-muted">E-post</dt>
                  <dd>
                    <a href={`mailto:${lead.contact.email}`} className="hover:underline">
                      {lead.contact.email}
                    </a>
                  </dd>
                </div>
              )}
              {lead.contact.phone && (
                <div className="flex gap-2">
                  <dt className="text-muted">Telefon</dt>
                  <dd>{lead.contact.phone}</dd>
                </div>
              )}
              <div className="pt-1">
                {lead.contact.verified ? <Badge tone="success">Verifierad</Badge> : <Badge tone="warning">Ej verifierad</Badge>}
              </div>
            </dl>
          ) : (
            <form action={lookupLeadContact} className="space-y-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <p className="text-sm text-muted">Inga kontaktuppgifter hittade än.</p>
              <Button type="submit">Sök kontaktuppgifter</Button>
            </form>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Utfall</h2>
        <div className="flex flex-wrap items-end gap-2">
          <form action={setLeadOutcome} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <label htmlFor="outcome" className="sr-only">
              Utfall
            </label>
            <select id="outcome" name="outcome" defaultValue={lead.outcome} key={lead.outcome} className={`${inputClass} w-auto`}>
              {outcomeOrder.map((o) => (
                <option key={o} value={o}>
                  {outcomeLabel[o]}
                </option>
              ))}
            </select>
            <Button type="submit">Spara utfall</Button>
          </form>
          {lead.outcome !== "not_a_fit" && (
            <form action={markLeadNotRelevant}>
              <input type="hidden" name="leadId" value={lead.id} />
              <Button type="submit" variant="danger">
                Inte relevant
              </Button>
            </form>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">
          När personen markeras som Svarat avbryts väntande uppföljningar. Inte relevant avbryter allt som väntar.
        </p>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Utskick</h2>
          {lead.outcome !== "not_a_fit" && (
            <form action={draftOutreach} className="flex flex-wrap gap-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <span className="self-center text-xs text-muted">Skriv utkast:</span>
              <Button type="submit" name="kind" value="invite">
                Kontaktförfrågan
              </Button>
              <Button type="submit" name="kind" value="message">
                Meddelande
              </Button>
              <Button type="submit" name="kind" value="follow_up">
                Uppföljning
              </Button>
            </form>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Inga utskick till den här personen än.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-foreground">{outreachKindLabel[item.kind]}</span>
                  <Badge tone={item.status === "sent" ? "success" : item.status === "cancelled" ? "neutral" : "accent"}>
                    {outreachStatusLabel[item.status]}
                  </Badge>
                  {item.cancelReason && <span>{item.cancelReason}</span>}
                </div>
                <p className="whitespace-pre-wrap">{item.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function LeadPage(props: PageProps<"/leads/[id]">) {
  return (
    <>
      <Link href="/leads" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← Alla leads
      </Link>
      <Suspense fallback={<Loading />}>
        <LeadDetail params={props.params} />
      </Suspense>
    </>
  );
}
