import { defineFlow, runFlow } from '@genkit-ai/flow';
import { gemini15Flash } from '@genkit-ai/googleai';
import { generate } from '@genkit-ai/ai';
import { z } from 'zod';

export const sentimentAnalyzer = defineFlow(
    {
        name: 'sentimentAnalyzer',
        inputSchema: z.object({
            text: z.string(),
            context: z.string().optional(),
        }),
        outputSchema: z.object({
            sentiment: z.enum(['positive', 'negative', 'neutral']),
            confidence: z.number(),
            reasoning: z.string(),
        }),
    },
    async (input) => {
        const prompt = `
      Analyze the sentiment of the following text snippet related to the brand "${input.context || 'unknown'}".
      Determine if it is Positive, Negative, or Neutral.
      
      Text: "${input.text}"
      
      Return JSON: { sentiment: "positive" | "negative" | "neutral", confidence: number (0-1), reasoning: string }
    `;

        const llmResponse = await generate({
            model: gemini15Flash,
            prompt: prompt,
            output: {
                schema: z.object({
                    sentiment: z.enum(['positive', 'negative', 'neutral']),
                    confidence: z.number(),
                    reasoning: z.string(),
                })
            }
        });

        return llmResponse.output();
    }
);
