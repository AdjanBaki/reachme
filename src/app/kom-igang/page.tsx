import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Loading, PageHeader } from "@/components/ui";
import { WorkspaceForm } from "@/components/workspace-form";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Kom igång" };

async function OnboardingForm() {
  const store = await getStore();
  const workspace = await store.getWorkspace();
  return <WorkspaceForm initial={workspace} mode="onboarding" />;
}

export default function OnboardingPage() {
  return (
    <>
      <PageHeader
        title="Kom igång"
        description="Berätta vad ni säljer och till vem. Varje morgon får ni en lista med personer som visar köpsignaler."
      />
      <Card className="p-5 sm:p-6">
        <Suspense fallback={<Loading />}>
          <OnboardingForm />
        </Suspense>
      </Card>
    </>
  );
}
