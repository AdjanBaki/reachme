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
