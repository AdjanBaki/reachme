# ReachMe

Finds people on LinkedIn who show buying signals for a customer's offer, scores them, and queues
outreach that the customer approves before anything is sent. The UI is in Swedish.

No outside services are connected yet. Every integration (LinkedIn, AI, contact lookup, email,
billing) sits behind an interface in `src/lib/integrations/` and currently uses offline stand-ins.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Data is stored in `.data/store.json` (git-ignored) and is seeded from
`src/lib/sample-data.ts` on first run. Delete the file to start over.

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run lint` – ESLint
- `npm test` – unit tests (Vitest)

## Structure

- `src/app/` – pages: `/leads`, `/redo-att-skicka`, `/kom-igang`, `/installningar`, `/sparrlista`, `/abonnemang`
- `src/lib/actions/` – server actions
- `src/lib/domain/` – pure business rules (daily limits, reply stops follow-ups, block list, score filter)
- `src/lib/store/` – `Repository` interface and the JSON file implementation; swap in a database in `store/index.ts`
- `src/lib/integrations/` – provider interfaces and stand-ins; swap in real providers in `integrations/index.ts`

This project uses Next.js 16 with Cache Components. Read `node_modules/next/dist/docs/` before
using Next.js APIs (see `AGENTS.md`).

## Kom igång med riktiga kopplingar

Appen fungerar utan nycklar, i exempelläge. Lägg till nycklar för det du vill koppla in:

1. Kopiera `.env.example` till `.env.local` i projektmappen. `.env.local` är ignorerad av git och checkas aldrig in.
2. Fyll i de nycklar du har (se nedan) och starta om appen (`npm run dev`).
3. Under **Inställningar → Kopplingar** ser du vad som är inkopplat.

**AI (Claude)** – gör webbplatsanalys, bedömning av leads och utkast på riktigt.
- Skapa en API-nyckel på https://console.anthropic.com under *API keys*.
- Lägg den i `ANTHROPIC_API_KEY`. Valfritt: välj modell med `ANTHROPIC_MODEL` (standard `claude-opus-5-5`).

**LinkedIn via Unipile** – automatisk sökning bland inlägg och utskick från ditt eget LinkedIn-konto.
- Skapa ett konto på https://www.unipile.com, skapa en **Production**-applikation och koppla ditt LinkedIn-konto.
- `UNIPILE_API_KEY`: under *API keys* i applikationen.
- `UNIPILE_DSN`: lämna tomt. Appen använder Unipiles v2-adress `https://api.unipile.com/v2`.
- `UNIPILE_ACCOUNT_ID`: id:t för det kopplade LinkedIn-kontot, börjar med `acc_` (under *Accounts*).

Utan Unipile fungerar LinkedIn-delen manuellt: klistra in inlägg på **Leads**, godkänn utkasten i
**Redo att skicka**, klicka **Kopiera och öppna profil**, skicka själv och markera som skickat.

**Om LinkedIn-automatik.** Automatiska utskick via tredjepartstjänster följer inte LinkedIns
användarvillkor, och LinkedIn kan begränsa konton som skickar för mycket. Appen minskar risken genom
låga volymer (standard 10 kontaktförfrågningar och 20 meddelanden per dag), en försiktig start de
första två veckorna, utskick bara vardagar 08–17 med slumpade pauser, godkännande av varje utskick och
automatisk paus om LinkedIn varnar. Risken går inte att ta bort helt.
