import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Card, Empty, Loading, Notice, PageHeader, ScoreBadge, buttonClass, inputClass } from "@/components/ui";
import { isBlocked, isSuppressed, meetsMinScore, visibleLeads } from "@/lib/domain/filters";
import { formatDate, outcomeLabel, outcomeOrder, signalLabel } from "@/lib/labels";
import { getStore } from "@/lib/store";
import type { LeadOutcome, SignalKind } from "@/lib/types";

export const metadata: Metadata = { title: "Leads" };

const signalKinds = Object.keys(signalLabel) as SignalKind[];

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

async function LeadsList({ searchParams }: { searchParams: PageProps<"/leads">["searchParams"] }) {
  const params = await searchParams;
  const outcome = pick<LeadOutcome>(params.utfall, outcomeOrder);
  const signalKind = pick<SignalKind>(params.signal, signalKinds);

  const store = await getStore();
  const [workspace, leads, blockList, removals] = await Promise.all([
    store.getWorkspace(),
    store.listLeads(),
    store.listBlockList(),
    store.listRemovalRequests(),
  ]);

  const leadsToShow = visibleLeads(leads, { minFitScore: workspace.minFitScore, outcome, signalKind }, blockList, removals);
  const belowScore = leads.filter(
    (l) => !isBlocked(l, blockList) && !isSuppressed(l.profileUrl, removals) && !meetsMinScore(l, workspace.minFitScore),
  ).length;
  const filtered = Boolean(outcome || signalKind);

  return (
    <>
      {!workspace.onboardedAt && (
        <div className="mb-4">
          <Notice tone="warning">
            Ni ser exempeldata. <Link href="/kom-igang" className="font-medium underline">Gå igenom Kom igång</Link> för att
            ställa in vad ni säljer och vem ni vill nå.
          </Notice>
        </div>
      )}

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-40">
          <label htmlFor="utfall" className="mb-1 block text-xs font-medium text-muted">
            Utfall
          </label>
          <select id="utfall" name="utfall" defaultValue={outcome ?? ""} className={inputClass}>
            <option value="">Alla</option>
            {outcomeOrder.map((o) => (
              <option key={o} value={o}>
                {outcomeLabel[o]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-40">
          <label htmlFor="signal" className="mb-1 block text-xs font-medium text-muted">
            Signal
          </label>
          <select id="signal" name="signal" defaultValue={signalKind ?? ""} className={inputClass}>
            <option value="">Alla</option>
            {signalKinds.map((k) => (
              <option key={k} value={k}>
                {signalLabel[k]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass("secondary", "py-2")}>
          Filtrera
        </button>
        {filtered && (
          <Link href="/leads" className={buttonClass("ghost", "py-2")}>
            Rensa
          </Link>
        )}
      </form>

      <p className="mb-3 text-sm text-muted">
        {leadsToShow.length} {leadsToShow.length === 1 ? "lead" : "leads"} med minst {workspace.minFitScore} % matchning
        {belowScore > 0 && ` · ${belowScore} under gränsen döljs`}
      </p>

      {leadsToShow.length === 0 ? (
        <Empty>{filtered ? "Inga leads matchar filtret." : "Inga leads än. Nya leads dyker upp efter morgonens sökning."}</Empty>
      ) : (
        <ul className="space-y-3">
          {leadsToShow.map((lead) => (
            <li key={lead.id}>
              <Card className="transition-colors hover:border-accent">
                <Link href={`/leads/${lead.id}`} className="block">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium">{lead.fullName}</p>
                      <p className="truncate text-sm text-muted">
                        {lead.headline}
                        {lead.location && ` · ${lead.location}`}
                      </p>
                    </div>
                    {lead.source === "import" ? <Badge>Importerad</Badge> : <ScoreBadge score={lead.fitScore} />}
                  </div>
                  {lead.signal && <p className="mt-3 line-clamp-2 text-sm">”{lead.signal.text}”</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone={lead.outcome === "new" ? "accent" : "neutral"}>{outcomeLabel[lead.outcome]}</Badge>
                    {lead.signal && <span>{signalLabel[lead.signal.kind]}</span>}
                    <span>Hittad {formatDate(lead.foundAt)}</span>
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function LeadsPage(props: PageProps<"/leads">) {
  return (
    <>
      <PageHeader title="Leads" description="Personer som visat köpsignaler, sorterade efter hur väl de matchar er idealkund." />
      <Suspense fallback={<Loading />}>
        <LeadsList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
