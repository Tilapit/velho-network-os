// Claude rewrites the template draft in the founder's voice. It only sees the
// evidence the score already used, and it is told not to add facts. Without
// ANTHROPIC_API_KEY the template is returned unchanged.
import Anthropic from "@anthropic-ai/sdk";
import type { Opportunity } from "./score.ts";
import type { Action } from "./recommend.ts";

export function claudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function rewriteDraft(o: Opportunity, action: Action, language = process.env.DRAFT_LANGUAGE || "English"): Promise<{ draft: string; by: "claude" | "template"; error?: string }> {
  if (!claudeAvailable() || !action.draft) return { draft: action.draft, by: "template" };
  const evidence = o.parts
    .flatMap((p) => p.reasons.filter((r) => r.points > 0).map((r) => `- [${p.label}, ${r.provenance}] ${r.text}`))
    .join("\n");
  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 400,
      system:
        "You write short, personal messages for the founder of Velho, a small Finnish AI and software consultancy for manufacturers and other operational companies. " +
        "Write as the founder, first person, warm and plain. No hype, no buzzwords, no flattery. " +
        "Use only the facts in the evidence. Never mention that the recipient liked or reacted to a post. A public comment may be referenced. " +
        "One low-pressure ask at most. Under 80 words. Return only the message text.",
      messages: [
        {
          role: "user",
          content: `Action: ${action.title}\nRecipient: ${action.recipient}\nWhy: ${action.why}\nEvidence:\n${evidence}\n\nTemplate to improve:\n${action.draft}\n\nWrite the message in ${language}.`,
        },
      ],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return text ? { draft: text, by: "claude" } : { draft: action.draft, by: "template", error: "Empty reply" };
  } catch (e) {
    return { draft: action.draft, by: "template", error: e instanceof Error ? e.message : String(e) };
  }
}
