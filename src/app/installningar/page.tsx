import type { Metadata } from "next";
import { Suspense } from "react";
import { SendingForm } from "@/components/sending-form";
import { Badge, Button, Card, Loading, Notice, PageHeader } from "@/components/ui";
import { WorkspaceForm } from "@/components/workspace-form";
import { resumeSending } from "@/lib/actions/sending";
import { integrationStatus } from "@/lib/config";
import { sendingSettings } from "@/lib/domain/pacing";
import { formatDateTime } from "@/lib/labels";
import { getStore } from "@/lib/store";
import { DAILY_LIMITS } from "@/lib/types";

export const metadata: Metadata = { title: "Inställningar" };

async function SettingsForm() {
  const store = await getStore();
  const workspace = await store.getWorkspace();
  return <WorkspaceForm initial={workspace} mode="settings" />;
}

function StatusRow({ label, connected, hint }: { label: string; connected: boolean; hint: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2 text-xs text-muted">
        {!connected && <span>{hint}</span>}
        {connected ? <Badge tone="success">Inkopplad</Badge> : <Badge tone="warning">Exempelläge</Badge>}
      </span>
    </li>
  );
}

async function Connections() {
  const store = await getStore();
  const status = integrationStatus();
  const workspace = await store.getWorkspace();
  const paused = workspace.sendingState?.pausedAt;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border">
        <StatusRow label="AI" connected={status.ai} hint="Lägg in ANTHROPIC_API_KEY i .env.local" />
        <StatusRow label="LinkedIn" connected={status.linkedin} hint="Lägg in UNIPILE-nycklarna i .env.local" />
      </ul>
      {!status.linkedin && (
        <p className="text-xs text-muted">
          Utan LinkedIn-koppling fungerar appen manuellt: klistra in inlägg på Leads och skicka själv via knappen
          Kopiera och öppna profil.
        </p>
      )}
      {workspace.lastScanAt && <p className="text-xs text-muted">Senaste sökning: {formatDateTime(workspace.lastScanAt)}</p>}
      {paused && (
        <Notice tone="danger">
          <p>
            <strong>Utskicken pausades {formatDateTime(paused)}.</strong> {workspace.sendingState?.pauseReason}
          </p>
          <form action={resumeSending} className="mt-2">
            <Button type="submit">Återuppta utskick</Button>
          </form>
        </Notice>
      )}
    </div>
  );
}

async function Sending() {
  const store = await getStore();
  const workspace = await store.getWorkspace();
  return (
    <SendingForm initial={sendingSettings(workspace.sending)} maxInvites={DAILY_LIMITS.invite} maxMessages={DAILY_LIMITS.message} />
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Inställningar" description="Kopplingar, erbjudande, målgrupp och utskickstakt." />
      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-2 text-base font-semibold">Kopplingar</h2>
          <Suspense fallback={<Loading />}>
            <Connections />
          </Suspense>
        </Card>
        <Card className="p-5 sm:p-6">
          <Suspense fallback={<Loading />}>
            <SettingsForm />
          </Suspense>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 text-base font-semibold">Utskickstakt</h2>
          <p className="mb-4 text-sm text-muted">
            Låga volymer i jämn takt under arbetstid skyddar ditt LinkedIn-konto. Inget skickas utan att du godkänt det.
          </p>
          <Suspense fallback={<Loading />}>
            <Sending />
          </Suspense>
        </Card>
      </div>
    </>
  );
}
