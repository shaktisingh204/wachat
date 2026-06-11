/**
 * SabSheet AI — natural-language → spreadsheet formula.
 *
 * Clones the structure of the other genkit flows in this folder (zod input/output
 * schemas + `ai.defineFlow` + `ai.generate`). The prompt is grounded so the model
 * always returns a single valid spreadsheet formula starting with `=`.
 */
import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

export const sabsheetFormulaGenInput = z.object({
    prompt: z.string(),
    /** Optional human-readable description of the sheet (headers, ranges) for grounding. */
    sheetSchema: z.string().optional(),
});

export const sabsheetFormulaGenOutput = z.object({
    formula: z.string(),
    explanation: z.string(),
});

export type SabsheetFormulaGenInput = z.infer<typeof sabsheetFormulaGenInput>;
export type SabsheetFormulaGenOutput = z.infer<typeof sabsheetFormulaGenOutput>;

export const sabsheetFormulaGen = ai.defineFlow(
    {
        name: 'sabsheetFormulaGen',
        inputSchema: sabsheetFormulaGenInput,
        outputSchema: sabsheetFormulaGenOutput,
    },
    async (input): Promise<SabsheetFormulaGenOutput> => {
        const { prompt, sheetSchema } = input;

        const grounded = `
You are a world-class spreadsheet formula engineer (Excel / Google Sheets dialect, which IronCalc follows).
Convert the user's request into ONE valid spreadsheet formula.

Hard rules:
1. The "formula" field MUST start with "=" and contain a single, syntactically valid formula.
2. Use standard functions (SUM, AVERAGE, IF, VLOOKUP, INDEX, MATCH, XLOOKUP, SUMIF, COUNTIF, TEXT, etc.).
3. Use A1-style references and ranges. Do NOT invent sheet names not present in the schema.
4. Never wrap the formula in backticks, quotes, or markdown.
5. "explanation" is one or two plain-English sentences describing what the formula does.

Sheet schema (headers / ranges available), may be empty:
${sheetSchema?.slice(0, 2000) || '(not provided)'}

User request:
"${prompt}"

Return JSON of exactly: { "formula": "=...", "explanation": "..." }
`;

        const { output } = await ai.generate({
            prompt: grounded,
            output: { schema: sabsheetFormulaGenOutput },
        });

        if (output?.formula) {
            let formula = output.formula.trim();
            if (!formula.startsWith('=')) formula = `=${formula}`;
            return { formula, explanation: output.explanation ?? '' };
        }

        return {
            formula: '=',
            explanation: 'Could not generate a formula for this request.',
        };
    },
);
