import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Wachat → WhatsApp Ads → AI ad-copy generation.
 *
 * NEXT-ONLY feature (no Rust crate). Mirrors the existing Genkit LLM
 * pattern used across the app (see `src/app/dashboard/seo/tools/ad-copy-generator/actions.ts`
 * and `src/ai/flows/*`): genkit + googleAI plugin + the `gemini15Flash`
 * model, with `ai.generate({ prompt, output: { schema } })` for typed
 * structured output.
 *
 * Takes a free-text product/offer prompt and returns a click-to-WhatsApp
 * ad-copy bundle: `{ primaryText, headline, description, creativeIdea }`.
 */

const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});

/** Structured ad-copy bundle returned to the client. camelCase, matching the page UI. */
const AdCopyOutputSchema = z.object({
  primaryText: z
    .string()
    .describe(
      'The main ad body text (1-3 short sentences). Conversational, benefit-led, with a clear nudge to tap and start a WhatsApp chat. May use 1-2 tasteful emojis.',
    ),
  headline: z
    .string()
    .describe('A punchy headline under ~40 characters that drives the WhatsApp message action.'),
  description: z
    .string()
    .describe('A short supporting description / link description under ~30 words.'),
  creativeIdea: z
    .string()
    .describe(
      'A concrete visual/creative direction for the ad image or video (composition, subject, mood).',
    ),
});

export interface GenerateAdCopyRequest {
  prompt: string;
}

export type GenerateAdCopyResponse = z.infer<typeof AdCopyOutputSchema>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Partial<GenerateAdCopyRequest>;
  try {
    body = (await req.json()) as Partial<GenerateAdCopyRequest>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const offer = (body.prompt ?? '').trim();
  if (!offer) {
    return NextResponse.json(
      { error: 'Describe what you are promoting to generate ad copy.' },
      { status: 400 },
    );
  }

  const prompt = `You are an expert performance marketer who writes high-converting click-to-WhatsApp (CTW) ad copy for Facebook and Instagram. A tap on the ad opens a WhatsApp chat with the business, so every piece of copy should push the reader to start a conversation.

Product / offer to promote:
${offer}

Write one strong ad-copy variation. Rules:
1. primaryText: 1-3 short sentences, conversational and benefit-led, ending with a clear nudge to tap and message on WhatsApp. At most 2 tasteful emojis.
2. headline: punchy, under ~40 characters, action-oriented.
3. description: short supporting line, under ~30 words.
4. creativeIdea: a concrete visual/creative direction for the accompanying image or video.

Return only the structured fields.`;

  try {
    const { output } = await ai.generate({
      prompt,
      output: { schema: AdCopyOutputSchema },
    });

    if (output) {
      return NextResponse.json(output satisfies GenerateAdCopyResponse);
    }

    throw new Error('No output generated');
  } catch (err) {
    console.error('WhatsApp Ads AI copy generation error:', err);
    return NextResponse.json(
      { error: 'AI generation failed. Please try again in a moment.' },
      { status: 502 },
    );
  }
}
