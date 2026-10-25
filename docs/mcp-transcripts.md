# MCP transcripts

Three questions asked with Claude Code (`claude -p`) against the local Velho Network MCP server. Setup:

- Connected with `claude mcp add --transport http velho http://localhost:3310/api/mcp`, on port 3310 because 3100 was taken that night.
- `claude/velho-network/SKILL.md` was added as the system prompt.
- Only the `velho` tools were allowed.

The data is the invented demo network, so every person is made up and every company is real. Links point to the local web app. Recorded 25 Oct 2026, about 00:15–00:25.

These answers predate the morning's UX pass. Since then the demo marks large groups such as Kemira as not a target, and This week puts people with a fresh registered change or reaction first. A live `this_week` now returns other people than the weekly review below.

## Weekly review (Finnish)

> Tee meille tämän viikon katsaus: viisi ihmistä, joille kannattaa olla yhteydessä, perustelut ja lyhyet viestiluonnokset.

Tool calls:

1. `find_people` {"fit": "strong", "status": "none", "limit": 15}
1. `message_context` {"person_id": "4ed9b1b726", "type": "direct"}
1. `message_context` {"person_id": "bf623cb900", "type": "direct"}
1. `message_context` {"person_id": "63fa6c5952", "type": "direct"}
1. `message_context` {"person_id": "8c19377ec5", "type": "direct"}
1. `message_context` {"person_id": "9ce8872a50", "type": "direct"}

Answer (8 turns, $0.46):

Tämän viikon viisi: kaikilla vahva sopivuus, ei vielä statusta ja kaikilla on PRH:hon kirjattu muutos viimeisen 90 päivän ajalta. Toimialoja on viisi eri.

| # | Henkilö | Miksi nyt | Lähettäjä |
|---|---|---|---|
| 1 | [Aleksi Sirviö](http://localhost:3310/people/4ed9b1b726), Supply Chain Director, Specim (Oulu) | Uusi toimitusjohtaja kirjattu 13.10. Kaksi tiimistä tuntee hänet (Co-founder, Board member). | Co-founder |
| 2 | [Anna Hiltunen](http://localhost:3310/people/bf623cb900), tehtaanjohtaja, Leipomo Rosten (Turku) | Hallitus vaihtui 5.8. Kaksi tiimistä tuntee hänet (Co-founder, sinä). | Co-founder |
| 3 | [Matti Ylitalo](http://localhost:3310/people/63fa6c5952), COO, Nurminen Logistics (Helsinki) | Osakeanti tai pääomankorotus kirjattu 28.7. Olette olleet yhteydessä LinkedInissä vuodesta 2016. | Sinä |
| 4 | [Tiina Koski](http://localhost:3310/people/8c19377ec5), COO, Honkarakenne (Karstula) | Uusi toimitusjohtaja kirjattu 4.9. | Board member |
| 5 | [Anders Strömberg](http://localhost:3310/people/9ce8872a50), tuotantojohtaja, Saalasti Biomass (Espoo) | Yritysjärjestely kirjattu 30.9. ja uusi toimitusjohtaja 9.10. | Sinä |

## Viestiluonnokset

**1. Aleksi Sirviö (lähettää Co-founder)**
> Hei Aleksi, näin että Specimillä vaihtui lokakuussa toimitusjohtaja. Autamme Velhossa valmistavia pk-yrityksiä käyttämään tekoälyä ja automaatiota suunnittelussa, raportoinnissa ja nykyisissä järjestelmissä. Kiinnostaisi kuulla, missä toimitusketjun suunnittelussa kuluu eniten käsityötä. Olisiko sinulla 20 minuuttia ensi viikolla? Ihan ok sanoa ei.

**2. Anna Hiltunen (lähettää Co-founder)**
> Hei Anna, näin että Leipomo Rostenin hallitus vaihtui elokuussa. Teemme Velhossa tekoälyä ja automaatiota tuotannon suunnitteluun ja raportointiin suomalaisille valmistajille, olemassa olevien järjestelmien päälle. Kiinnostaisi kuulla, missä leipomon suunnittelu vie eniten aikaa. Olisiko sinulla 20 minuuttia ensi viikolla? Ihan ok sanoa ei.

**3. Matti Ylitalo (lähetät sinä)**
> Hei Matti, näin kaupparekisteristä, että Nurminen Logistics haki kesällä uutta pääomaa. Autamme Velhossa logistiikka- ja teollisuusyrityksiä käyttämään tekoälyä ja automaatiota suunnittelussa, raportoinnissa ja nykyisissä järjestelmissä. Jos näitä mietitään teillä nyt, vaihtaisin mielelläni ajatuksia. Sopisiko 20 minuuttia ensi viikolla? Ihan ok sanoa ei.

**4. Tiina Koski (lähettää Board member)**
> Hei Tiina, näin että Honkarakenteella vaihtui syyskuussa toimitusjohtaja. Olen mukana Velhossa, joka auttaa pk-valmistajia käyttämään tekoälyä ja automaatiota suunnittelussa, tarjouslaskennassa ja raportoinnissa. Kiinnostaisi kuulla, missä puutalotuotannon suunnittelussa kuluu eniten käsityötä. Olisiko sinulla 20 minuuttia ensi viikolla? Ihan ok sanoa ei.

**5. Anders Strömberg (lähetät sinä)**
> Hei Anders, näin että Saalasti Biomassille on kirjattu syksyllä sekä yritysjärjestely että toimitusjohtajan vaihdos. Teemme Velhossa tekoälyä ja automaatiota tuotannon suunnitteluun, tarjouslaskentaan ja raportointiin suomalaisille konevalmistajille. Jos näitä katsotaan teillä nyt uusiksi, kertoisin mielelläni, miten olemme tehneet sitä muualla. Olisiko 20 minuuttia ensi viikolla? Ihan ok sanoa ei.

## Huomioitavaa ennen lähettämistä
- **Tarkista nimike:** tiedot ovat LinkedIn-exportista, ja nimike on se, joka oli voimassa exportin latauspäivänä.
- **Tarkista koko:** henkilöstömäärä ei ole PRH:n datassa, joten tarkista yrityksen koko ennen yhteydenottoa.
- **Honkarakenne:** tunnet myös [Matti Salmen](http://localhost:3310/people/8ddbc26f79) (logistiikkajohtaja). Älä ota samalla viikolla yhteyttä kahteen saman yrityksen ihmiseen. Pidä hänet varalla, jos Tiina ei vastaa.
- **Varalla:** [Camilla Lehtinen](http://localhost:3310/people/06547ba332), Satron Instruments. Yritykselle on kirjattu sekä toimitusjohtajan että hallituksen vaihdos, ja tunnet hänet itse. Jäi pois vain, koska Specim on jo samalta toimialalta (sähkö ja elektroniikka). Nimike on ruotsiksi, joten voin kirjoittaa viestin ruotsiksi, jos se sopii.

Viestit ovat vain luonnoksia. Jokainen lähettää omansa itse LinkedInistä tai sähköpostista. Merkitse status sovellukseen, kun viesti on lähtenyt.

---

## Logistics roundtable

> We're hosting a logistics roundtable in Helsinki in November. Who from our network should we invite, and who should we ask for an intro?

Tool calls:

1. `people_for_theme` {"theme": "Logistics roundtable in Helsinki, November 2026", "industries": ["logistics", "wholesale", "maritime"], "limit": 30}
1. `people_for_theme` {"theme": "Logistics roundtable in Helsinki, November 2026", "industries": ["logistics"], "limit": 100}

Answer (4 turns, $0.54):

I used the logistics group as the core and added a few people from two nearby groups: supply chain and procurement leads in wholesale, and sea freight in maritime. I left out the boat and ship builders that the maritime group also contains. Nobody on either list has a status yet, so none of them have been contacted.

## Invite (decision-makers)

| Person | Company | Why now | Sender |
|---|---|---|---|
| [Matti Ylitalo](http://localhost:3310/people/63fa6c5952), COO | Nurminen Logistics, Helsinki | Strongest fit (83). New share issue or capital increase registered 28 Jul 2026 | You |
| [Oskar Koivula](http://localhost:3310/people/e592d87d60), Head of Supply Chain | Telko, Espoo | Strong fit. Board changed 21 Aug 2026 | You |
| [Antti Pekkarinen](http://localhost:3310/people/69a9f12470), COO | ESL Shipping, Helsinki | Sea freight. Board changed 20 Aug 2026 | Board member |
| [Terhi Tirkkonen](http://localhost:3310/people/aa6608ba45), Operativ direktör | Varsinais-Suomen Kaukokiito, Turku | Strong fit, runs a freight terminal operator. Would travel from Turku | Board member |
| [Arttu Mäntyniemi](http://localhost:3310/people/92d14acbdb), Myyntijohtaja | Hacklin Logistics, Espoo | Known by both you and the co-founder | You |
| [Laura Hietala](http://localhost:3310/people/643503cd79), Business Director | Etra, Helsinki | All three teammates know her | Board member |
| [Aino Kivelä](http://localhost:3310/people/06b2a41d94), Head of Procurement | Kesko, Helsinki | Large Helsinki wholesaler, 8 connections there | You |
| [Atte Harjukoski](http://localhost:3310/people/89e081be22), Talousjohtaja | Varova, Helsinki | Helsinki logistics company. Finance, not operations | Co-founder |

You could also invite [Ville Isoaho](http://localhost:3310/people/fb146fe4ec), Finance Director at Nurminen, through the board member. Two people from one company at a small table is a lot, so I'd start with Matti.

## Ask for an intro (we don't know the decision-maker)

- **Kuljetusrinki** (road freight, Helsinki): the best intro target. A merger or demerger was registered 23 Sep 2026 and the board changed 15 Oct 2026. Ask [Riikka Lehtimäki](http://localhost:3310/people/57162558b4) (Hankintapäällikkö, you know her) or [Satu Mäkinen](http://localhost:3310/people/27077f8cd0) (co-founder knows her) who runs operations now.
- **Finnair** (Vantaa): the board changed 8 Oct 2026. The team has 9 connections there but no decision-maker. The most relevant way in is [Markus Kaartinen](http://localhost:3310/people/98608b5311), Supply Chain Manager, whom the co-founder knows. [Kirsi Ahomäki](http://localhost:3310/people/ff7988db0a) (Production Supervisor, you know her) is also an option. The tool listed her under "invite", but her role usually recommends rather than decides, so I moved her here.
- **Oulun Kaukokiito**: you know [Noora Halonen](http://localhost:3310/people/ad08ac6e52) there. The company is registered in Rovaniemi, so it's low priority for a Helsinki event.

## Caveats

- **Locations are company home towns from the trade register, not where people sit.** The data doesn't say where anyone is based.
- **Probably a wrong match:** [Mika Jokinen](http://localhost:3310/people/932b08e79f), a Software Engineer, is linked to "Aws Oy", which the trade register lists as a passenger transport company. It looks like a name collision with Amazon Web Services. I left him out, and it's worth correcting in the app.
- I left out the wholesale production heads (Muurame, Lihatukku Harri Tamminen, Pakkasmarja). If you want a broader supply chain table, I can add them.
- **Terhi's title is in Swedish.** If you agree, her invite could be in Swedish.

Should I draft the invites? I'd write one per person in Finnish for the suggested sender, using only the facts the tool returns for each person. Send me the date and venue, or I'll leave a placeholder.

---

## Radar for logistics

> What does the signal radar show for logistics companies? Which ones do we have a warm path into?

Tool calls:

1. `get_radar` {"industries": ["logistics"], "known": "known", "limit": 50}
1. `get_radar` {"industries": ["logistics"], "known": "unknown", "limit": 25}

Answer (4 turns, $0.32):

The radar has 433 logistics companies with a registered change in the last 90 days (26 Jul to 24 Oct). Someone on the team knows a person at only **3** of them.

## Warm paths

**1. [Nurminen Logistics Oyj](http://localhost:3310/companies/0109707-8)**: share issue or capital increase registered on 28 Jul. This is the best of the three.
- [Matti Ylitalo](http://localhost:3310/people/63fa6c5952), COO, **strong fit**, known by you. Start with him.
- [Ville Isoaho](http://localhost:3310/people/fb146fe4ec), Finance Director, possible fit, known by the board member.
- [Jari Ruuskanen](http://localhost:3310/people/60a4094cfc), no title on record, known by you.
- The signal is almost three months old and will drop out of the 90-day window soon. If you want to use it as the reason to get in touch, do it this week.

**2. [Kuljetusrinki Oy](http://localhost:3310/companies/1057810-5)**, Helsinki, road freight: a merger or demerger on 23 Sep, then two board changes (13 and 15 Oct). This is the most activity of the three.
- [Riikka Lehtimäki](http://localhost:3310/people/57162558b4), Hankintapäällikkö (procurement manager), known by you.
- [Satu Mäkinen](http://localhost:3310/people/27077f8cd0), no title on record, known by the co-founder.
- Neither person has a fit set yet. Riikka is the natural first conversation. Purchasing is often where processes get reworked after a merger.

**3. [Finnair Oyj](http://localhost:3310/companies/0108023-3)**: board change on 8 Oct. The team knows 9 people there, but this is a weak lead.
- A board change at a large listed company is routine and doesn't say much. Finnair is also not an SME.
- The most relevant contacts are [Markus Kaartinen](http://localhost:3310/people/98608b5311) (Supply Chain Manager, co-founder) and [Kirsi Ahomäki](http://localhost:3310/people/ff7988db0a) (Production Supervisor, possible fit, you). They're better treated as general network contacts than as a radar lead.

## Cold rows worth asking around about

All 430 of these are cold, so ask around before contacting anyone. These look most relevant for Velho:
- [Kuormat.com Finland](http://localhost:3310/companies/3192506-5), Helsinki: new money and a board change (21 Oct)
- [Kuljetusliike Juhani Tuominen](http://localhost:3310/companies/0500656-7), Orivesi: merger and new money (7–8 Oct)
- [Wetera Capital](http://localhost:3310/companies/2139699-9), Lahti, warehousing: new managing director (5 Oct), after a merger in August
- [Euroports Hanko](http://localhost:3310/companies/0103167-7), cargo handling: new managing director (25 Aug), board change (21 Oct)
- [Pumari](http://localhost:3310/companies/3560553-6), Tampere, freight brokerage: new managing director (6 Oct)
- [Salosen Kuljetus](http://localhost:3310/companies/2029519-2), [Ala-Korpela](http://localhost:3310/companies/0459158-1), [East-Team](http://localhost:3310/companies/2731139-4): road freight companies with a new managing director in October

**Possible bug:** commit `431d324` says taxis should get lower priority, but taxi firms (TOL 49330, such as IVY Taksi, Arvo Express and ATX-Palvelu) still score 5 and are at the top of the cold list. Either the lower weight isn't being applied to the score, or the server running on :3310 doesn't have that commit yet. I can look into it.

Next, I can write Finnish drafts to Matti Ylitalo and Riikka Lehtimäki, or pull a [company brief](http://localhost:3310/companies/1057810-5) on Kuljetusrinki before you get in touch.

---

## This week, through the token header (part 2)

Recorded 25 Oct 2026, about 01:15, to test the optional `MCP_TOKEN`. The
app ran with `MCP_TOKEN` set; the server was added in a scratch project
with Claude Code's header option:

```sh
claude mcp add --transport http --scope project velho-auth http://localhost:3310/api/mcp \
  --header "Authorization: Bearer <token>"
claude -p "Call the this_week tool of the velho-auth server once and reply with only the five names and their suggested sender, one per line." \
  --mcp-config .mcp.json --strict-mcp-config --allowedTools "mcp__velho-auth__this_week"
```

Tool calls: `this_week` {}

Answer (3 turns, $0.20):

- [Aleksi Sirviö](http://localhost:3310/people/4ed9b1b726): Co-founder
- [Camilla Lehtinen](http://localhost:3310/people/06547ba332): You
- [Kimmo Pitkäsalo](http://localhost:3310/people/23d5755b04): You
- [Laura Mäkelä](http://localhost:3310/people/acf69ec9c5): Co-founder
- [Tiina Koski](http://localhost:3310/people/8c19377ec5): Board member

The same five as the app's "This week". With curl, the same endpoint
answered 401 without the header and 401 with a wrong token.
