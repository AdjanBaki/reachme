import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, Button, Card, Loading, Notice, PageHeader } from "@/components/ui";
import { startCheckout } from "@/lib/actions/billing";
import { integrations } from "@/lib/integrations";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Abonnemang" };

// Placeholder prices. Replace when pricing is decided.
const plans = [
  {
    id: "monthly",
    name: "Månadsvis",
    price: "XXX kr",
    period: "per månad",
    note: "Ingen bindningstid.",
  },
  {
    id: "yearly",
    name: "Årsvis",
    price: "XXX kr",
    period: "per månad, faktureras årsvis",
    note: "Lägre pris mot ett års bindning.",
  },
] as const;

const included = [
  "Daglig sökning efter köpsignaler på LinkedIn",
  "AI-bedömning av hur väl varje person matchar",
  "Utkast till kontaktförfrågningar och meddelanden",
  "Dagliga gränser som skyddar ert konto",
  "Spärrlista och hantering av borttagningsbegäran",
];

async function Status() {
  const store = await getStore();
  const workspace = await store.getWorkspace();
  const active = await integrations.billing.isActive(workspace.id);
  return active ? (
    <Notice tone="success">Abonnemanget för {workspace.name} är aktivt.</Notice>
  ) : (
    <Notice tone="warning">Inget aktivt abonnemang för {workspace.name}.</Notice>
  );
}

export default function BillingPage() {
  return (
    <>
      <PageHeader title="Abonnemang" description="Välj hur ni vill betala. Ni kan byta när som helst." />
      <div className="space-y-6">
        <Suspense fallback={<Loading />}>
          <Status />
        </Suspense>

        <Notice tone="warning">
          <strong>Platshållare:</strong> priserna nedan är inte bestämda än och ingen betalning sker.
        </Notice>

        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{plan.name}</h2>
                <Badge tone="warning">Platshållarpris</Badge>
              </div>
              <p>
                <span className="text-3xl font-semibold">{plan.price}</span>{" "}
                <span className="text-sm text-muted">{plan.period}</span>
              </p>
              <p className="text-sm text-muted">{plan.note}</p>
              <form action={startCheckout} className="mt-auto">
                <input type="hidden" name="plan" value={plan.id} />
                <Button type="submit" variant="primary" className="w-full">
                  Välj {plan.name.toLowerCase()}
                </Button>
              </form>
            </Card>
          ))}
        </div>

        <Card>
          <h2 className="mb-2 text-sm font-semibold">Ingår i alla planer</h2>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {included.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
