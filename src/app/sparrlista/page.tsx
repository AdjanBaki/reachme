import type { Metadata } from "next";
import { Suspense } from "react";
import { AddBlockForm, CsvImportForm, RemovalRequestForm } from "@/components/blocklist-forms";
import { Badge, Button, Card, Loading, PageHeader } from "@/components/ui";
import { removeBlockEntry } from "@/lib/actions/blocklist";
import { blockKindLabel, formatDateTime } from "@/lib/labels";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Spärrlista" };

async function BlockList() {
  const store = await getStore();
  const entries = (await store.listBlockList()).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (entries.length === 0) return <p className="text-sm text-muted">Spärrlistan är tom.</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Badge>{blockKindLabel[entry.kind]}</Badge>
            <span className="truncate">{entry.value}</span>
          </span>
          <form action={removeBlockEntry}>
            <input type="hidden" name="id" value={entry.id} />
            <Button type="submit" variant="ghost" aria-label={`Ta bort ${entry.value} från spärrlistan`}>
              Ta bort
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}

async function RemovalList() {
  const store = await getStore();
  const requests = (await store.listRemovalRequests()).toSorted((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  if (requests.length === 0) return <p className="text-sm text-muted">Inga borttagningsbegäranden.</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {requests.map((r) => (
        <li key={r.id} className="px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{r.fullName ?? r.profileUrl}</span>
            <span className="text-xs text-muted">{formatDateTime(r.requestedAt)}</span>
          </div>
          {r.fullName && <p className="truncate text-xs text-muted">{r.profileUrl}</p>}
          <p className="text-xs text-muted">
            {r.deletedLeads > 0 ? "Uppgifter raderade" : "Inga uppgifter fanns"} · spärrad för framtiden
            {r.note && ` · ${r.note}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function BlockListPage() {
  return (
    <>
      <PageHeader
        title="Spärrlista"
        description="Personer och företag på listan visas aldrig som leads och får aldrig utskick."
      />
      <div className="space-y-6">
        <Card className="space-y-4">
          <h2 className="text-base font-semibold">Spärrade profiler och företag</h2>
          <AddBlockForm />
          <Suspense fallback={<Loading />}>
            <BlockList />
          </Suspense>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Borttagningsbegäran</h2>
            <p className="mt-1 text-sm text-muted">
              När någon ber att bli borttagen raderas personens lead och utskick direkt, och profilen läggs aldrig till igen.
            </p>
          </div>
          <RemovalRequestForm />
          <Suspense fallback={<Loading />}>
            <RemovalList />
          </Suspense>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Importera leads från CSV</h2>
            <p className="mt-1 text-sm text-muted">
              Vi letar upp alla LinkedIn-profiladresser i filen. Dubbletter och spärrade profiler hoppas över.
            </p>
          </div>
          <CsvImportForm />
        </Card>
      </div>
    </>
  );
}
