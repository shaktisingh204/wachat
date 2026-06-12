"use server";

/**
 * SabSMS composer — AI copy-assist server action (V2.12).
 *
 * Four one-shot rewrites for the send composer: shorter, friendlier,
 * add-CTA, translate-to-Hindi. Calls the project's canonical LLM
 * gateway (`generateSabcrmText` — AI Gateway → Anthropic → OpenAI
 * ladder). The body is PII-scrubbed (reversibly) before it leaves the
 * box and the originals are restored into the rewrite afterwards.
 *
 * DLT-safe mode: when the body contains `{#var#}` markers the model is
 * instructed to keep them verbatim, and the result is validated
 * post-hoc (`markersPreserved`) — a rewrite that touches a marker is
 * rejected, never silently returned.
 */

import { getCachedSession } from "@/lib/server-cache";
import { generateSabcrmText } from "@/lib/sabcrm/ai-llm.server";
import { scrubPii } from "@/lib/sabsms/agent/guardrails";
import { hasDltMarkers, markersPreserved } from "@/lib/sabsms/agent/markers";

export type AiAssistMode =
  | "shorter"
  | "friendlier"
  | "add_cta"
  | "translate_hindi";

const MODE_INSTRUCTIONS: Record<AiAssistMode, string> = {
  shorter:
    "Rewrite the SMS to be meaningfully shorter while keeping every essential fact. Aim for one SMS segment (under 160 GSM characters) when possible.",
  friendlier:
    "Rewrite the SMS in a warmer, friendlier tone. Keep it concise and professional — no emoji spam (at most one), no exclamation overload.",
  add_cta:
    "Rewrite the SMS to end with one clear, specific call to action appropriate to the message. Do not invent links, discounts, or claims that are not in the original.",
  translate_hindi:
    "Translate the SMS to natural, conversational Hindi (Devanagari script). Keep names, URLs, and codes unchanged.",
};

export type AiAssistResult =
  | { ok: true; body: string }
  | { ok: false; error: string };

export async function aiAssistAction(input: {
  body: string;
  mode: AiAssistMode;
}): Promise<AiAssistResult> {
  const session = await getCachedSession();
  if (!(session?.user as { _id?: unknown } | undefined)?._id) {
    return { ok: false, error: "Unauthorized" };
  }

  const body = (input.body ?? "").trim();
  if (!body) return { ok: false, error: "Type a message first." };
  if (body.length > 1600) {
    return { ok: false, error: "Message is too long for AI assist." };
  }
  const instruction = MODE_INSTRUCTIONS[input.mode];
  if (!instruction) return { ok: false, error: "Unknown assist mode." };

  // Reversible PII scrub — the gateway sees placeholders, the user gets
  // their real numbers/emails back in the rewrite.
  const scrub = scrubPii(body);
  const dltSafe = hasDltMarkers(body);

  const system = [
    "You rewrite SMS message bodies for a business messaging platform.",
    "Reply with ONLY the rewritten SMS body - no quotes, no preamble, no markdown.",
    "Tokens that look like «PII_…» are masked personal data - keep each one EXACTLY as-is.",
    dltSafe
      ? "The text contains DLT template markers like {#var#}. These are regulator-registered placeholders: keep every marker EXACTLY verbatim, same count - never translate, rename, drop, or add markers."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await generateSabcrmText({
    system,
    prompt: `${instruction}\n\nSMS body:\n${scrub.text}`,
    maxTokens: 500,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const rewrittenScrubbed = res.text.trim();
  if (!rewrittenScrubbed) {
    return { ok: false, error: "The AI returned an empty rewrite." };
  }

  // DLT validation runs on the scrubbed pair (markers are never PII).
  if (dltSafe && !markersPreserved(scrub.text, rewrittenScrubbed)) {
    return {
      ok: false,
      error:
        "The rewrite changed a {#var#} template marker, so it was rejected. Try again or edit manually.",
    };
  }

  const restored = scrub.restore(rewrittenScrubbed).trim().slice(0, 1600);
  return { ok: true, body: restored };
}
