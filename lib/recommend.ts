// Picks the next action deterministically, then writes a plain template draft.
// Claude can rewrite the draft (lib/claude.ts), but the choice of action and
// the evidence it rests on are made here, in code.
import type { Opportunity } from "./score.ts";
import { RELEVANT_TOPICS } from "./score.ts";
import { daysBetween, today } from "./normalize.ts";
import type { Model } from "./build.ts";

export type ActionType = "intro" | "congratulate" | "continue_comment" | "reconnect" | "share_example" | "hold" | "none";

export type Action = {
  type: ActionType;
  title: string;
  why: string;
  channel: string;
  /** Who the draft goes to. For an intro it is the connector, not the target. */
  recipient: string;
  draft: string;
};

export const ACTION_LABEL: Record<ActionType, string> = {
  intro: "Ask for an introduction",
  congratulate: "Congratulate on the new role",
  continue_comment: "Continue the conversation from the comments",
  reconnect: "Reconnect with a reason",
  share_example: "Share a relevant example",
  hold: "Don't reach out now",
  none: "No action this week",
};

const first = (name: string) => name.split(" ")[0];
const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export function nextAction(o: Opportunity, model: Model, now = today()): Action {
  const p = o.person;
  const posts = new Map(model.posts.map((x) => [x.id, x]));
  const company = o.company?.name ?? p.companyName ?? "their company";
  const freshSignal = o.signals.find((s) => daysBetween(s.on, now) <= 60);

  if (o.status === "hold") {
    return { type: "hold", title: ACTION_LABEL.hold, why: o.statusReason!, channel: "None", recipient: p.name, draft: "" };
  }
  if (o.status === "customer") {
    return { type: "none", title: "Customer: use as a connector", why: o.statusReason!, channel: "None", recipient: p.name, draft: "" };
  }

  const path = p.introPaths[0];
  if (!p.connected && path) {
    const via = model.byId.get(path.viaPersonId);
    const reason = freshSignal ? ` I saw a recent update from ${company} ("${freshSignal.title}"), and it sounds close to what we did for you.` : "";
    return {
      type: "intro",
      title: `${ACTION_LABEL.intro} from ${path.viaName}`,
      why: `${path.statement}${freshSignal ? ` ${company} has a fresh signal: ${freshSignal.title}.` : ""}`,
      channel: via?.isCustomerContact ? "Email or call (existing customer)" : "LinkedIn message",
      recipient: path.viaName,
      draft: `Hi ${first(path.viaName)}, you mentioned you know ${p.name} at ${company}.${reason} Would you be comfortable introducing us? Happy to write a short note you can forward, so it takes you a minute at most.`,
    };
  }

  const newRole = o.signals.find((s) => s.type === "leadership_change" && s.person === p.name && daysBetween(s.on, now) <= 60);
  if (newRole && p.connected) {
    const lastMet = p.interactions.at(-1);
    return {
      type: "congratulate",
      title: ACTION_LABEL.congratulate,
      why: `${newRole.title} (${newRole.sourceName}, ${newRole.on}). A new operations lead usually reviews how work gets done in the first months. Start with congratulations, not a pitch.`,
      channel: "LinkedIn message",
      recipient: p.name,
      draft: `Congratulations on the new role at ${company}, ${first(p.name)}!${lastMet ? ` It has been a while since we met in ${monthYear(lastMet.on)}.` : ""} If you ever want to compare notes on what the first 90 days look like on the operations side, I'm happy to grab a coffee.`,
    };
  }

  const lastComment = [...p.engagements].reverse().find((e) => e.kind === "comment" && RELEVANT_TOPICS.includes(posts.get(e.postId)?.topic ?? "other"));
  const lastTwoWay = [...p.interactions].reverse().find((i) => i.gotReply);

  if (p.connected && lastComment && daysBetween(lastComment.on, now) <= 60) {
    const post = posts.get(lastComment.postId);
    const signalLine = freshSignal ? ` I also saw the news from ${company} ("${freshSignal.title}"). Congratulations.` : "";
    return {
      type: "continue_comment",
      title: ACTION_LABEL.continue_comment,
      why: `${first(p.name)} commented on "${post?.title}" ${daysBetween(lastComment.on, now)} days ago${freshSignal ? ` and ${company} has a fresh signal: ${freshSignal.title}` : ""}. That is a public conversation you can pick up naturally.`,
      channel: "LinkedIn message",
      recipient: p.name,
      draft: `Hi ${first(p.name)}, thanks for your comment on my post "${post?.title}" You wrote: "${lastComment.comment}" I'd like to hear how you handle that today.${signalLine} Would a 20-minute call in the next couple of weeks be useful?`,
    };
  }

  if (lastTwoWay && freshSignal) {
    return {
      type: "reconnect",
      title: ACTION_LABEL.reconnect,
      why: `You last spoke ${daysBetween(lastTwoWay.on, now)} days ago (${lastTwoWay.summary}). ${company} has a fresh signal: ${freshSignal.title}.`,
      channel: "LinkedIn message",
      recipient: p.name,
      draft: `Hi ${first(p.name)}, I saw the news from ${company} ("${freshSignal.title}"). Congratulations. It has been a while since we spoke in ${monthYear(lastTwoWay.on)}. Is what we talked about then still on your list? Happy to share what we've seen work.`,
    };
  }

  if (lastTwoWay && daysBetween(lastTwoWay.on, now) <= 120) {
    return {
      type: "reconnect",
      title: ACTION_LABEL.reconnect,
      why: `You have a live two-way conversation: last reply ${daysBetween(lastTwoWay.on, now)} days ago (${lastTwoWay.summary}). Keep it warm with something useful, not a pitch.`,
      channel: "LinkedIn message",
      recipient: p.name,
      draft: `Hi ${first(p.name)}, following up on our conversation in ${monthYear(lastTwoWay.on)}. We just wrote up how we approached a similar case for another manufacturer, happy to send it over if useful. No agenda beyond that.`,
    };
  }

  if (p.connected && p.engagements.some((e) => RELEVANT_TOPICS.includes(posts.get(e.postId)?.topic ?? "other"))) {
    return {
      type: "share_example",
      title: ACTION_LABEL.share_example,
      why: `${first(p.name)} keeps engaging with posts about your services, but you have never spoken. Share something useful before asking for anything.`,
      channel: "LinkedIn message",
      recipient: p.name,
      draft: `Hi ${first(p.name)}, we've been working on order intake and quoting for a few manufacturers like ${company}. I put together a short write-up of what changed for one of them. Want me to send it over?`,
    };
  }

  return { type: "none", title: ACTION_LABEL.none, why: "No credible reason to reach out yet.", channel: "None", recipient: p.name, draft: "" };
}

export type Check = { ok: boolean; text: string };

/** Founder reputation safeguards, checked on every draft before approval. */
export function safeguards(o: Opportunity, draft: string, model?: Model, now = today()): Check[] {
  const words = draft.trim().split(/\s+/).filter(Boolean).length;
  // For an introduction the message goes to the connector, so check their history.
  const via = !o.person.connected && o.person.introPaths[0] && model ? model.byId.get(o.person.introPaths[0].viaPersonId) : undefined;
  const who = via ?? o.person;
  const lastOut = [...who.interactions].reverse().find((i) => i.direction !== "inbound");
  const recent = lastOut ? daysBetween(lastOut.on, now) : Infinity;
  return [
    { ok: recent > 7, text: recent === Infinity ? `You have not messaged ${who.name.split(" ")[0]} before` : recent > 7 ? `Last contact with ${who.name.split(" ")[0]} was ${recent} days ago` : `You were in touch with ${who.name.split(" ")[0]} ${recent} days ago. Wait a few days.` },
    { ok: !/\b(liked|reacted|saw your reaction|saw you (liked|reacted))\b/i.test(draft), text: "Does not tell them you tracked their likes or reactions" },
    { ok: words <= 90, text: `${words} words${words <= 90 ? "" : ". Shorten to 90 or less."}` },
    { ok: (draft.match(/\?/g) || []).length <= 2, text: "One clear, low-pressure ask" },
  ];
}
