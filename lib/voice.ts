// Velho's voice for outreach messages: config/velho-voice.md is the source
// of truth. message_context hands it to Claude; without an API key the app
// writes the same shape from these templates. Signals choose who and when;
// a message never says where a fact came from.
import fs from "node:fs";
import path from "node:path";

export type MessageType = "direct" | "ask_intro" | "reaction_followup" | "follow_up" | "event_invite";
export const MESSAGE_TYPES = ["direct", "ask_intro", "reaction_followup", "follow_up", "event_invite"] as const satisfies readonly MessageType[];

/** The voice file as written, for Claude (message_context and the skill). */
export function readVoice(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "config", "velho-voice.md"), "utf8");
  } catch {
    return "";
  }
}

export const MAX_CHARS = 500;

/** Words a message must never contain: where facts came from, scores, apologies. */
export const NEVER = /kaupparekister|\bPRH\b|\bYTJ\b|kirjattiin|rekisteröi|osakeanti|pääomaa|uutta rahaa|hallitus(?:ta|een)? vaihtui|toimitusjohtaja vaihtui|fuusio|sulautu|pistee?t|\bscore\b|analyysimme|datamme|ihan ok sanoa ei/i;

export const VELHO_FI = "Olen nykyään mukana Velhossa, jossa rakennamme tekoälyä ja automaatiota yritysten raportointiin ja arjen prosesseihin.";
const ASK_FI = "Ehtisitkö 20 minuutin puheluun tai kahville ensi viikolla?";

/**
 * "Intergrid" -> "Intergridille", "Esimerkki Konepaja" -> "Esimerkki
 * Konepajalle". A Finnish word whose last syllable gradates ("Rahti" ->
 * "Rahdille") is not guessed: it becomes "teille", which always reads right.
 */
export function allative(name: string): string {
  const n = name.trim();
  if (!n || /(kk|pp|tt|nt|nk|mp|lt|rt|ht)[aeiouyäö]$/i.test(n)) return "teille";
  if (/[aeiouyäö]$/i.test(n)) return `${n}lle`;
  return `${n}ille`;
}

/** One concrete question by what they do, from the title's area. */
const QUESTION: Record<string, string> = {
  finance: "Kiinnostaisi kuulla, missä raportoinnissa tai laskutuksessa teillä menee eniten aikaa käsityöhön.",
  sales: "Kiinnostaisi kuulla, missä tarjousten tai tilausten käsittelyssä teillä menee eniten aikaa käsityöhön.",
  production: "Kiinnostaisi kuulla, missä tuotannon suunnittelussa teillä menee eniten aikaa käsityöhön.",
  operations: "Kiinnostaisi kuulla, missä arjen prosesseissa teillä menee eniten aikaa käsityöhön.",
  default: "Kiinnostaisi kuulla, missä teillä menee eniten aikaa käsityöhön.",
};

export type TemplateInput = {
  type: MessageType;
  firstName: string;
  /** Short company name ("Intergrid"), or "" when unknown. */
  company: string;
  area?: string;
  /** reaction_followup: the post's label, when the team gave it one. */
  postTopic?: string;
  /** reaction_followup: the sender wrote the post ("postaukseeni"), else the team did. */
  ownPost?: boolean;
  /** event_invite: the event in a few words. */
  theme?: string;
};

/** The message without an API key: Velho's voice, from these facts only. */
export function templateMessage(t: TemplateInput): string {
  const hi = `Hei ${t.firstName}!`;
  const how = t.company ? `Mitä ${allative(t.company)} kuuluu?` : "Mitä kuuluu?";
  const q = QUESTION[t.area ?? ""] ?? QUESTION.default;
  if (t.type === "follow_up") return `${hi} Palaan vielä aiempaan viestiini. Ehtisitkö jossain vaiheessa 20 minuutin puheluun tai kahville? Hyvää viikkoa!`;
  if (t.type === "ask_intro") return `${hi} ${how} ${VELHO_FI} Kuka teillä vastaa prosesseista ja raportoinnista? Voisitko esitellä meidät?`;
  if (t.type === "event_invite") return `${hi} ${how} Kokoamme pienen porukan juttelemaan aiheesta ${t.theme ?? "tekoäly arjen töissä"}. ${VELHO_FI} Haluaisitko mukaan?`;
  if (t.type === "reaction_followup") {
    const post = t.ownPost ? "postaukseeni" : "postaukseemme";
    return `${hi} Kiitos kun reagoit ${post}${t.postTopic ? ` ${t.postTopic}` : ""}! ${VELHO_FI} ${q} ${ASK_FI}`;
  }
  return `${hi} ${how} ${VELHO_FI} ${q} ${ASK_FI}`;
}

/** Problems with a message against the voice: forbidden words, length. Empty when it is fine. */
export function voiceProblems(text: string): string[] {
  const out: string[] = [];
  const m = text.match(NEVER);
  if (m) out.push(`Mentions "${m[0]}": never say where a fact came from.`);
  if (text.length > MAX_CHARS) out.push(`${text.length} characters; keep it under ${MAX_CHARS}.`);
  return out;
}
