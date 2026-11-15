import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Loading, PageHeader } from "@/components/ui";
import { WorkspaceForm } from "@/components/workspace-form";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Inställningar" };

async function SettingsForm() {
  const store = await getStore();
  const workspace = await store.getWorkspace();
  return <WorkspaceForm initial={workspace} mode="settings" />;
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Inställningar" description="Erbjudande, målgrupp och när den dagliga sökningen körs." />
      <Card className="p-5 sm:p-6">
        <Suspense fallback={<Loading />}>
          <SettingsForm />
        </Suspense>
      </Card>
    </>
  );
}
