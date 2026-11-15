import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OutreachCard } from "@/components/outreach-card";
import { Badge, Card, Empty, Loading, PageHeader } from "@/components/ui";
import { isBlocked, isSuppressed } from "@/lib/domain/filters";
import { dayKey, isPending, remainingQuota } from "@/lib/domain/outreach";
import { formatDateTime, outreachKindLabel } from "@/lib/labels";
import { getStore } from "@/lib/store";
import { DAILY_LIMITS, type OutreachKind } from "@/lib/types";

export const metadata: Metadata = { title: "Redo att skicka" };

const kinds = Object.keys(DAILY_LIMITS) as OutreachKind[];

async function Queue() {
  const store = await getStore();
  const [outreach, leads, blockList, removals] = await Promise.all([
    store.listOutreach(),
    store.listLeads(),
    store.listBlockList(),
    store.listRemovalRequests(),
  ]);
  const now = new Date();
  const quota = remainingQuota(outreach, now);
  const leadById = new Map(leads.map((l) => [l.id, l]));

  // Blocked or removed people never show up in the queue.
  const allowed = outreach.filter((item) => {
    const lead = leadById.get(item.leadId);
    return lead && !isBlocked(lead, blockList) && !isSuppressed(lead.profileUrl, removals);
  });
  const pendingItems = allowed
    .filter(isPending)
    .sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved") || a.createdAt.localeCompare(b.createdAt));
  const today = dayKey(now);
  const sentToday = allowed
    .filter((i) => i.status === "sent" && i.sentAt && dayKey(new Date(i.sentAt)) === today)
    .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));

  return (
    <>
      <section aria-label="Kvar att skicka i dag" className="mb-6 grid gap-3 sm:grid-cols-3">
        {kinds.map((kind) => (
          <Card key={kind}>
            <p className="text-xs text-muted">{outreachKindLabel[kind]}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {quota[kind]}
              <span className="text-sm font-normal text-muted"> / {DAILY_LIMITS[kind]} kvar i dag</span>
            </p>
          </Card>
        ))}
      </section>

      <h2 className="mb-3 text-base font-semibold">Väntar på dig ({pendingItems.length})</h2>
      {pendingItems.length === 0 ? (
        <Empty>
          Inget väntar. Öppna en <Link href="/leads" className="underline">lead</Link> och skapa ett utkast.
        </Empty>
      ) : (
        <div className="space-y-3">
          {pendingItems.map((item) => {
            const lead = leadById.get(item.leadId)!;
            return (
              <OutreachCard
                key={item.id}
                item={item}
                leadName={lead.fullName}
                leadHeadline={lead.headline}
                quotaLeft={quota[item.kind]}
              />
            );
          })}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-base font-semibold">Skickat i dag ({sentToday.length})</h2>
      {sentToday.length === 0 ? (
        <p className="text-sm text-muted">Inget skickat i dag än.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {sentToday.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <Link href={`/leads/${item.leadId}`} className="hover:underline">
                {leadById.get(item.leadId)?.fullName}
              </Link>
              <span className="flex items-center gap-2 text-xs text-muted">
                <Badge>{outreachKindLabel[item.kind]}</Badge>
                {item.sentAt && formatDateTime(item.sentAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function OutreachPage() {
  return (
    <>
      <PageHeader
        title="Redo att skicka"
        description="Inget skickas utan att du godkänt det. Gränserna per dag skyddar ert LinkedIn-konto."
      />
      <Suspense fallback={<Loading />}>
        <Queue />
      </Suspense>
    </>
  );
}
