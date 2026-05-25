'use server';

import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { parseHtml } from '@/lib/seo-tools/api-client';

const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

export const generateAdCopyAction = async (input: {
    product: string;
    audience: string;
    keyword: string;
    tone: string;
    urlContext?: string;
}) => {
    const { product, audience, keyword, tone, urlContext } = input;

    let extraContext = '';
    if (urlContext) {
        extraContext = `\nContext extracted from URL:\n${urlContext.slice(0, 1000)}\n`;
    }

    const prompt = `
Act as an expert Digital Marketer and PPC Copywriter. 
Generate 5 distinct variations of ad headlines and 3 distinct variations of ad descriptions for a PPC campaign.

Parameters:
- Product/Service: ${product}
- Target Audience: ${audience}
- Target Keyword: ${keyword}
- Tone: ${tone}${extraContext}

Rules:
1. Headlines: Up to 30 characters each. Must be catchy.
2. Descriptions: Up to 90 characters each. Must include a Call To Action (CTA).
3. The tone should strictly match the requested tone (${tone}).

Output JSON format exactly like this:
{
  "headlines": ["Headline 1", "Headline 2", "Headline 3", "Headline 4", "Headline 5"],
  "descriptions": ["Description 1", "Description 2", "Description 3"]
}
    `;

    try {
        const { output } = await ai.generate({
            prompt,
            output: {
                schema: z.object({
                    headlines: z.array(z.string()),
                    descriptions: z.array(z.string())
                })
            }
        });

        if (output) {
            return output;
        }

        throw new Error("No output generated");
    } catch (e) {
        console.error("Ad Copy Gen Error:", e);
        return {
            headlines: [
                `Get ${product} Today`,
                `Best ${product}`,
                `Looking for ${keyword}?`,
            ],
            descriptions: [
                `Try ${product} for ${audience}. Perfect for your needs.`,
                `The top solution for ${keyword}. Don't wait, buy now.`
            ]
        };
    }
};
