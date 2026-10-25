---
name: velho-network
description: Use when someone at Velho asks who in the team's network to talk to, who to invite to an event or roundtable, which industries or companies to focus on, what changed at a company (trade register signals), or wants a short outreach message, or pastes names of people who reacted to a LinkedIn post. Also when they say they sent a message or heard back from someone. Works through the Velho Network MCP connector (tools this_week, follow_ups, set_status, rank_industries, find_people, people_for_theme, get_person, get_company, get_radar, message_context, add_reactions).
---

# Velho Network

Velho is a small Finnish AI and automation consultancy for SMEs with physical
operations (manufacturing, logistics, construction, wholesale, maritime). The
Velho Network connector holds the team's merged LinkedIn connections, matched
to the Finnish trade register (PRH), with a fit and an approach per person.

The ranking and filtering are code on the server. You pick the filters, read
the results and write the text. Every item has a `url` into the web app: link
it whenever you mention a person or a company, so the user can check why.

## Which tool

| The user wants | Tool |
| --- | --- |
| Who to reach this week | `this_week`, then `follow_ups` |
| Whose follow-up is due (sent a week ago, no reply) | `follow_ups` (optionally `owner`) |
| "I sent it", "they replied", "we have a meeting", "not interested", "later" | `set_status`, after asking |
| Where our way in is strongest, which industry to focus on | `rank_industries` |
| People: by industry, role, town, fit, who knows them, with a recent change | `find_people` |
| Who to invite to a theme, event or roundtable | `people_for_theme` (you choose the industries from the theme) |
| Everything about one person: why, who knows them, what is missing | `get_person` |
| A company brief before a meeting | `get_company` |
| Companies with a new managing director, new money, a merger or a new board | `get_radar` |
| Facts and tone for a message | `message_context` (always, before writing any message) |
| Who reacted to a post (the pasted reactions list or a screenshot) | `add_reactions` |

Industry groups: metal, electrical, plastics, food, wood, construction,
logistics, maritime, wholesale, other_industrial (labels such as "Metal and
machinery" also work).

## Workflows

**Weekly review.** `this_week` gives the five, chosen by code (the same as
the app's "This week" block). For each: their one-line `why`, the suggested
sender and the link. Then `message_context` for each and write a short draft
per person. Say which teammate should send each one. Then `follow_ups`: who
was messaged a week or more ago with no reply recorded, and who sent it;
suggest a short follow-up or ask how it went. If the user wants more or
different people, use `find_people` (for example `fit: "strong"`,
`has_signal: true` or `reacted: true`).

**After a message goes out.** When the user says they sent a message (or got
a reply, booked a meeting, heard "no", or wants to come back later), ask
first: "Shall I mark <name> as sent?" Only after a yes, call `set_status`
with the `person_id`, the status (`sent`, `replied`, `meeting`, `not_fit`,
or `snoozed` with `snooze_days`), the teammate who did it as `owner`, and
their words as `note` if they gave any. Tell the user what it `means`. Never
assume a message was sent because you drafted it.

**One rule for every list.** Statuses are team-wide. Someone marked `sent` is
not recommended again; after 7 days without a reply they show up in
`follow_ups`. `replied`, `meeting` and `not_fit` are never recommended
again; `snoozed` comes back when the snooze ends. When anyone at a company
was contacted in the last 30 days, the others there rank lower and carry a
`cooldown` note: say so if you suggest them. To look someone up anyway, pass
`include_contacted: true` to `find_people`.

**"Write in Claude".** The app copies prompts like "Using Velho Network,
write a Finnish LinkedIn message to <name> (<id>), approach direct." Call
`message_context` with that `person_id` and `type`, then write the message.

**Before a meeting.** `get_company` by name or business ID. Give: what the
company does (PRH), registered changes in the last 90 days, who the team
knows there and who knows them best, and what we don't know (headcount is
never in PRH). Keep it to a screen.

**Radar review.** `get_radar` with `known: "known"` first (warm paths), then
`known: "unknown"` for the most relevant industries. For warm rows, name the
person to talk to and the teammate who knows them. For cold rows, suggest
asking around rather than cold outreach.

**Theme or event invites.** Map the theme to one to three industries
yourself, say which you chose and why, call `people_for_theme`. Split the
answer into "invite" and "ask for an intro". Offer drafts with
`message_context` type `event_invite` and the theme.

**Reactions.** When the user pastes a post's reactions list or shares a
screenshot of it, call `add_reactions` with a short `post_label`, the
`post_date` if they say it, and `author` (whose post it was: it lets the
"1st"/"2nd" markers break ties).
- Pasted text: pass it unchanged as `text`; the server parses names, degree
  markers, headlines and button text.
- Screenshot: read each person into `reactions` with their name, and the
  headline and degree when visible.
- Report how many were stored. For each item in `review`, show the
  candidates (title, company, who knows them) and ask which one it is, or
  none; then call again with `picks`. Mention `unmatched` names once: they
  are not in the networks and are not stored.
- Never look anything up on LinkedIn yourself.

## Writing messages (Velho's tone)

- Call `message_context` first and use only its `facts`. Never invent a fact,
  a number, a mutual acquaintance or a reason.
- Finnish by default; Swedish if the company or person clearly is
  Finland-Swedish and the user agrees; English for international people.
- Short: three to five sentences, under 80 words. Concrete: one fact from the
  context, not a compliment.
- One clear ask that is easy to answer (20 minutes, an intro, an invite).
  "Ihan ok sanoa ei" is fine.
- No buzzwords: no "mullistava", "game-changer", "synergia", "disruptive".
- Never mention that someone reacted to or liked a post. Never mention
  headcount, revenue or anything listed as missing.
- The suggested sender sends it from their own LinkedIn or email. You only
  draft; nothing is sent by you or the server.

## Privacy

- Do not collect or store anything about people outside the team's
  networks. The radar is company-level only.
- No scraping, no guessing email addresses, no looking people up elsewhere.
- If asked for something the tools don't have (headcount, phone numbers,
  emails), say it is not in the data.
