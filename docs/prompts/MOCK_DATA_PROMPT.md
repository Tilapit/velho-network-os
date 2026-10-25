# Task: a realistic mock LinkedIn export with about 1,500 connections

Before we touch the founder's real data, build a mock `Connections.csv` that
looks and behaves like the real export of a Finnish AI consultancy founder
who has been active in the Helsinki startup scene for about ten years. It is
the test bed for the whole demo (import, PRH matching, profile filter,
weekly list, the network view), so its mess must be realistic.

## Output

- `scripts/generate-mock-connections.mjs`: a seeded, deterministic generator
  (same seed, same file). Node only, no network at generation time except the
  optional PRH check below.
- `data/demo/Connections.csv`: about 1,500 rows. Replace the old 57-row demo
  file. Keep the old one as `data/demo/Connections-small.csv` so nothing that
  depends on it breaks; update tests that counted 57 rows.
- `data/demo/README.md`: one paragraph saying every person is invented, the
  companies are real Finnish and international companies used only so PRH
  matching can be tested, and nothing here describes a real person.
- A short report printed by the generator: rows, share per segment, share of
  empty fields, number of distinct companies.

## Exact file format (LinkedIn's export)

```
Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing. You will only see email addresses for connections who have allowed their connections to see or download their email address using this setting https://www.linkedin.com/psettings/privacy/email. You can learn more here https://www.linkedin.com/help/linkedin/answer/261"

First Name,Last Name,URL,Email Address,Company,Position,Connected On
```

- `Connected On` as `12 Apr 2026`. UTF-8, quoted fields where needed.
- `URL`: `https://www.linkedin.com/in/<slug>` with realistic slugs: firstname-lastname,
  firstname-lastname-1a2b3c4d, a few vanity slugs. All invented.
- `Email Address`: empty for about 95% of rows. Where present, use
  `@example.com` addresses only. Never a real company domain.

## Who is in the network (shares of about 1,500)

| Segment | Share | Notes |
| --- | --- | --- |
| Startups and scale-ups, mostly Helsinki | 25% | founders, engineers, designers, growth; many not decision-makers for Velho |
| Software, IT consultancies, agencies | 12% | competitors and peers, not targets |
| Students and academia (Aalto, Hanken, University of Helsinki, Vaasa, Tampere) | 12% | "Student", "Doctoral Researcher", board roles in student associations |
| Large Finnish corporates (over 1,000 people) | 10% | Nokia, KONE, Wärtsilä, UPM, Fortum, Valmet, Kesko, S Group style employers; mostly specialists and managers |
| **Target: Finnish SMEs with physical operations, about 20–300 people** | **18%** | manufacturing, industrial, metal, plastics, food production, logistics, construction, wholesale, maritime. About a third in decision-making roles |
| Investors, accelerators, ecosystem (VCs, Business Finland, Startup Foundation, Aaltoes, Slush) | 6% | |
| Public sector and NGOs | 4% | |
| International companies abroad | 8% | Sweden, Estonia, Germany, US; should not match in PRH |
| Self-employed, stealth, between jobs, empty company | 5% | "Self-employed", "Stealth", "Freelancer", "", "Open to work" |

Include about 10 to 15 connections who work at Velho's plausible existing
customers or partners and a handful of other Velho employees, so the founder's
own world feels real. Mark nothing as special in the file.

## Companies

- Use real company names so PRH matching is real. For the target segment,
  pick about 150 real Finnish SMEs. Check each against the PRH YTJ open data
  API once (read the API docs first, cache responses in `data/cache/`) and
  replace any that do not exist, so most target companies match. Leave the
  other segments unchecked; some failing to match is realistic.
- Make company names messy the way real profiles are: "KONE", "KONE Oyj",
  "Kone Corporation"; "Wärtsilä" and "Wartsila"; "Aalto University" and
  "Aalto-yliopisto"; with and without "Oy", "Oyj", "Ab", "Group", "Finland";
  a few typos; a few rows where the company field holds a tagline instead.
- Several people per company is normal for corporates and startups, one or
  two per SME.

## People

- Invented names only, never a real person's. Generate from first and last
  name lists: about 78% Finnish, 7% Finland-Swedish, 15% international. Use
  realistic frequencies so common names repeat, and include at least five
  exact duplicate names at different companies, so name-only matching would
  go wrong.
- At real companies with fewer than about 50 people, do not give a fictional
  person the CEO or toimitusjohtaja title, because that role is identifiable.
  Use other decision-maker titles there (COO, Head of Operations, Production
  Director, Tuotantojohtaja, CFO, Owner is also out).
- Titles messy like real LinkedIn: English, Finnish and Swedish mixed
  ("Toimitusjohtaja", "VD", "Head of Growth 🚀", "Operations Manager | Lean | ERP",
  "Co-founder & CEO", "Board member", "Opiskelija"), about 8% empty, some very
  long, a few in ALL CAPS.
- Decision-maker share about 20% overall, higher in the target segment.

## Dates

- `Connected On` from 2015 to the current month, weighted towards recent
  years, with visible bumps every November and December (Slush) and after
  Aaltoes events in spring. No dates in the future.

## Check before you finish

- Import the file through the app's existing parser and show the import
  summary. It must parse every row.
- Print 20 random rows so I can eyeball realism.
- Run `npm test` and fix tests that assumed 57 rows.

Then continue with `NETWORK_DEMO_PROMPT.md`, using this file as the test data.
