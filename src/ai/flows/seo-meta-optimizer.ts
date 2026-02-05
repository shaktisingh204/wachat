import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

export const seoMetaOptimizer = ai.defineFlow(
    {
        name: 'seoMetaOptimizer',
        inputSchema: z.object({
            currentTitle: z.string().optional(),
            currentDesc: z.string().optional(),
            targetKeyword: z.string(),
            pageContent: z.string().optional(),
        }),
        outputSchema: z.object({
            optimizedTitle: z.string(),
            optimizedDesc: z.string(),
            reasoning: z.string(),
            alternatives: z.array(z.object({
                title: z.string(),
                desc: z.string()
            }))
        }),
    },
    async (input) => {
        const { currentTitle, currentDesc, targetKeyword, pageContent } = input;

        const prompt = `
      Act as a high-end SEO Copywriter. Optimize the meta tags for a page targeting the keyword: "${targetKeyword}".

      Current State:
      - Title: ${currentTitle || 'Missing'}
      - Description: ${currentDesc || 'Missing'}
      - Content Snippet: ${pageContent?.slice(0, 500) || 'Not provided'}

      Rules:
      1. Title: 50-60 characters, include keyword near front, compelling hook.
      2. Description: 150-160 characters, include keyword, call to action.
      3. Tone: Professional, Click-inducing (High CTR).

      Output JSON format:
      {
        "optimizedTitle": "Top choice title",
        "optimizedDesc": "Top choice description",
        "reasoning": "Why this is better",
        "alternatives": [
            { "title": "Alt 1", "desc": "Alt 1 desc" },
            { "title": "Alt 2", "desc": "Alt 2 desc" }
        ]
      }
    `;

        const { output } = await ai.generate(prompt);

        try {
            const text = output?.text || '';
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
            throw new Error("No JSON found");
        } catch (e) {
            return {
                optimizedTitle: `Best ${targetKeyword} - Updated`,
                optimizedDesc: `Learn more about ${targetKeyword}.`,
                reasoning: "Fallback generation due to error.",
                alternatives: []
            };
        }
    }
);
