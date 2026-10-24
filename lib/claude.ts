// "Possible angle for Velho": one sentence, written by Claude from the facts in
// the analysis, only when ANTHROPIC_API_KEY is set. Claude gets the role and
// company facts of one person, never their name, and never changes the fit or
// the ranking. Without a key the template from lib/analysis.ts is used.
import Anthropic from "@anthropic-ai/sdk";
import type { Analysis } from "./analysis.ts";

export function claudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export const ANGLE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

/** The facts Claude may use. Exported so the UI can show exactly what was sent. */
export function angleFacts(a: Analysis): string {
  return [
    `Title (LinkedIn): ${a.title || "empty"}`,
    `Company (PRH): ${a.company.name}${a.company.industry ? `, ${a.company.industry}` : ""}${a.company.tol ? ` (TOL ${a.company.tol})` : ""}`,
    `Industry group: ${a.company.groupLabel}`,
    ...a.reasons.filter((r) => r.kind === "role" || r.kind === "signal").map((r) => `${r.label}: ${r.text}`),
    `Fit: ${a.fitLabel}. ${a.fitWhy}`,
    "Unknown: headcount, revenue, current systems.",
  ].join("\n");
}

export async function writeAngle(a: Analysis): Promise<{ text: string; by: "claude" | "template"; error?: string }> {
  if (!claudeAvailable()) return { text: a.angle.text, by: "template" };
  const client = new Anthropic();
  try {
    const params = {
      model: ANGLE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" as const },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "You suggest one possible angle for Velho, a small Finnish AI and automation consultancy for SMEs with physical operations (manufacturing, logistics, construction, wholesale, maritime). " +
        "Write one sentence in English, under 35 words, saying what Velho could help this person's company with and why it fits their role. " +
        "Use only the facts given. Do not invent numbers, systems, problems or events. Do not mention headcount or revenue. No buzzwords. Return only the sentence.",
      messages: [{ role: "user" as const, content: angleFacts(a) }],
    };
    // `fallbacks` re-runs a declined request on another model inside the same call.
    const msg = (await client.beta.messages.create(params as unknown as Parameters<typeof client.beta.messages.create>[0])) as Anthropic.Beta.BetaMessage;
    if (msg.stop_reason === "refusal") return { text: a.angle.text, by: "template", error: "Claude declined; showing the template" };
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return text ? { text, by: "claude" } : { text: a.angle.text, by: "template", error: "Empty reply" };
  } catch (e) {
    return { text: a.angle.text, by: "template", error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- "Draft here" ----------

type DraftContext = { type: string; facts: string[]; mustNotUse: string[]; tone: string[]; examples: string[] };

/**
 * What a draft request sends: the message context with the person's name
 * replaced by [FIRST_NAME], so no name leaves this machine. The server puts
 * the first name back into the reply.
 */
export function draftPrompt(ctx: DraftContext): string {
  const facts = ctx.facts.map((f) => (f.startsWith("Name: ") ? "Name: [FIRST_NAME] (write [FIRST_NAME] where their first name goes)" : f));
  return [
    `Message type: ${ctx.type}`,
    "Facts (use only these):",
    ...facts.map((f) => `- ${f}`),
    "Do not use:",
    ...ctx.mustNotUse.map((f) => `- ${f}`),
    "Tone rules:",
    ...ctx.tone.map((f) => `- ${f}`),
    "Examples about made-up companies (for style only, never for facts):",
    ...ctx.examples.map((f) => `- ${f}`),
  ].join("\n");
}

export async function writeDraft(ctx: DraftContext, firstName: string): Promise<{ text: string; model: string } | { error: string }> {
  if (!claudeAvailable()) return { error: "No ANTHROPIC_API_KEY set. Use Write in Claude instead." };
  const client = new Anthropic();
  try {
    const params = {
      model: ANGLE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" as const },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "You draft one short LinkedIn message for Velho, a small Finnish AI and automation consultancy. Follow the tone rules exactly and use only the facts given. " +
        "Write [FIRST_NAME] for the recipient's first name. Return only the message text, no subject line, no quotes, no notes.",
      messages: [{ role: "user" as const, content: draftPrompt(ctx) }],
    };
    const msg = (await client.beta.messages.create(params as unknown as Parameters<typeof client.beta.messages.create>[0])) as Anthropic.Beta.BetaMessage;
    if (msg.stop_reason === "refusal") return { error: "Claude declined to write this one." };
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return text ? { text: text.replaceAll("[FIRST_NAME]", firstName), model: msg.model } : { error: "Empty reply" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
