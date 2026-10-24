# Velho Network OS

Who should I talk to this week, why now, and what should I say?

A relationship intelligence prototype for Velho's founder. It combines the
founder's LinkedIn connections, engagement on their posts, existing customers,
their own conversation notes and company signals, and suggests a few people to
talk to each week with the evidence behind each suggestion. The founder
approves every action; nothing is sent from the app.

The bundled data is synthetic. Every person, company and post is invented.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3100. Optional: copy `.env.example` to `.env.local` and
add `ANTHROPIC_API_KEY` so "Rewrite with Claude" works. Without it the app uses
its built-in draft templates.

To freeze the demo date: `APP_TODAY=2026-10-24 npm run dev`.

## Use your own data

On the Data sources page, replace any file:

- **Connections.csv**: LinkedIn → Settings → Data privacy → Get a copy of your data → Connections. Upload it as is.
- **engagement.csv**: who reacted to or commented on selected posts. LinkedIn has no export for this, so prepare it by hand for a few posts. Include profile URLs for exact matching.
- **customers.csv, interactions.csv, relationships.csv, companies.csv**: see `data/demo/` for the columns.
- **signals.json**: output of the company-signal pipeline.

## Test

```sh
npm test
```
