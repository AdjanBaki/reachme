import { sampleLeads, sampleWorkspace } from "@/lib/sample-data";
import type { SignalKind } from "@/lib/types";

const signalLabel: Record<SignalKind, string> = {
  post: "Inlägg",
  comment: "Kommentar",
  like: "Gillning",
  new_role: "Ny roll",
};

export default function LeadsPage() {
  const leads = sampleLeads
    .filter((l) => l.fitScore >= sampleWorkspace.minFitScore)
    .sort((a, b) => b.fitScore - a.fitScore);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Dagens leads</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {leads.length} personer med köpsignal för {sampleWorkspace.name} (exempeldata)
      </p>
      <ul className="mt-6 space-y-4">
        {leads.map((lead) => (
          <li key={lead.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <a href={lead.profileUrl} className="font-medium hover:underline">
                  {lead.fullName}
                </a>
                <p className="text-sm text-neutral-500">
                  {lead.headline} · {lead.location}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {lead.fitScore} %
              </span>
            </div>
            <blockquote className="mt-3 border-l-2 border-neutral-300 pl-3 text-sm dark:border-neutral-700">
              <span className="text-xs uppercase tracking-wide text-neutral-500">
                {signalLabel[lead.signal?.kind ?? "post"]}
              </span>
              <p>{lead.signal?.text}</p>
              <a href={lead.signal?.url} className="text-xs text-neutral-500 hover:underline">
                Visa på LinkedIn
              </a>
            </blockquote>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              <span className="font-medium">Varför:</span> {lead.fitReason}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
