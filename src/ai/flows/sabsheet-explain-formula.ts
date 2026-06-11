/**
 * SabSheet AI — explain an existing spreadsheet formula in plain English.
 *
 * Mirrors the other genkit flows in this folder (zod schemas + `ai.defineFlow`).
 */
import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

export const sabsheetExplainFormulaInput = z.object({
    formula: z.string(),
});

export const sabsheetExplainFormulaOutput = z.object({
    explanation: z.string(),
});

export type SabsheetExplainFormulaInput = z.infer<typeof sabsheetExplainFormulaInput>;
export type SabsheetExplainFormulaOutput = z.infer<typeof sabsheetExplainFormulaOutput>;

export const sabsheetExplainFormula = ai.defineFlow(
    {
        name: 'sabsheetExplainFormula',
        inputSchema: sabsheetExplainFormulaInput,
        outputSchema: sabsheetExplainFormulaOutput,
    },
    async (input): Promise<SabsheetExplainFormulaOutput> => {
        const { formula } = input;

        const grounded = `
You are a spreadsheet expert. Explain the following spreadsheet formula in clear, plain English
for a non-technical user. Describe step by step what it computes, what each function does, and what
the referenced cells/ranges represent. Be concise (2-5 sentences). Do not rewrite the formula.

Formula:
${formula}

Return JSON of exactly: { "explanation": "..." }
`;

        const { output } = await ai.generate({
            prompt: grounded,
            output: { schema: sabsheetExplainFormulaOutput },
        });

        return {
            explanation: output?.explanation ?? 'No explanation could be generated.',
        };
    },
);
