/**
 * SabSheet AI — apply a natural-language transform to a column of values.
 *
 * Given an instruction (e.g. "clean phone numbers", "categorize by sentiment",
 * "extract the domain from each email") and an array of cell values, returns a
 * results array of the SAME length, aligned 1:1 with the input.
 *
 * Mirrors the other genkit flows in this folder (zod schemas + `ai.defineFlow`).
 */
import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

export const sabsheetColumnTransformInput = z.object({
    instruction: z.string(),
    values: z.array(z.string()),
});

export const sabsheetColumnTransformOutput = z.object({
    results: z.array(z.string()),
});

export type SabsheetColumnTransformInput = z.infer<typeof sabsheetColumnTransformInput>;
export type SabsheetColumnTransformOutput = z.infer<typeof sabsheetColumnTransformOutput>;

export const sabsheetColumnTransform = ai.defineFlow(
    {
        name: 'sabsheetColumnTransform',
        inputSchema: sabsheetColumnTransformInput,
        outputSchema: sabsheetColumnTransformOutput,
    },
    async (input): Promise<SabsheetColumnTransformOutput> => {
        const { instruction, values } = input;

        if (values.length === 0) {
            return { results: [] };
        }

        const grounded = `
You transform a column of spreadsheet cell values according to an instruction.

Instruction:
"${instruction}"

You are given an array of ${values.length} input values (0-indexed). Produce an output array
of EXACTLY ${values.length} strings, where output[i] is the transformed value of input[i].

Hard rules:
1. The "results" array MUST have exactly ${values.length} entries — one per input, in the same order.
2. If a value cannot be transformed, return the original value unchanged (do not drop or reorder).
3. Each result is a plain string (no markdown, no surrounding quotes).

Input values (JSON array):
${JSON.stringify(values).slice(0, 12000)}

Return JSON of exactly: { "results": ["...", "..."] }
`;

        const { output } = await ai.generate({
            prompt: grounded,
            output: { schema: sabsheetColumnTransformOutput },
        });

        const results = output?.results ?? [];

        // Guarantee the contract: same length as the input, aligned 1:1.
        const normalized = values.map((original, i) =>
            typeof results[i] === 'string' ? results[i] : original,
        );

        return { results: normalized };
    },
);
