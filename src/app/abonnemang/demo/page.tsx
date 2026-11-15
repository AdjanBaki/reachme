import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Notice, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Kassa (demo)" };

async function PlanName({ searchParams }: { searchParams: PageProps<"/abonnemang/demo">["searchParams"] }) {
  const { plan } = await searchParams;
  return <>{plan === "yearly" ? "Årsvis" : "Månadsvis"}</>;
}

/** Stand-in for the real checkout page until a payment provider is connected. */
export default function DemoCheckoutPage(props: PageProps<"/abonnemang/demo">) {
  return (
    <>
      <PageHeader title="Kassa" />
      <Card className="space-y-4">
        <Notice tone="warning">
          Det här är en demo. Ingen betalningstjänst är inkopplad och ingen betalning sker.
        </Notice>
        <p className="text-sm">
          Vald plan:{" "}
          <strong>
            <Suspense fallback="…">
              <PlanName searchParams={props.searchParams} />
            </Suspense>
          </strong>
        </p>
        <Link href="/abonnemang" className={buttonClass("secondary")}>
          Tillbaka till abonnemang
        </Link>
      </Card>
    </>
  );
}
