import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

const ai = genkit({
    plugins: [googleAI()],
    model: gemini15Flash,
});

export const seoSchemaGenerator = ai.defineFlow(
    {
        name: 'seoSchemaGenerator',
        inputSchema: z.object({
            url: z.string(),
            pageTitle: z.string().optional(),
            contentSummary: z.string().optional(),
            businessType: z.string().optional().default('Organization'),
        }),
        outputSchema: z.object({
            schemaType: z.string(),
            jsonLd: z.string(),
            explanation: z.string(),
        }),
    },
    async (input) => {
        const { url, pageTitle, contentSummary, businessType } = input;

        const prompt = `
      You are an expert Technical SEO Specialist.
      Your task is to generate valid JSON-LD Schema markup for a webpage.
      
      Context:
      - URL: ${url}
      - Title: ${pageTitle || 'Unknown'}
      - Summary: ${contentSummary || 'Generic business page'}
      - Desired Type: ${businessType}

      Instructions:
      1. Generate a valid JSON-LD object for the specified type (e.g., Organization, LocalBusiness, Article, Product).
      2. Ensure it includes the @context ("https://schema.org") and @type.
      3. Use the provided URL and Title. Invent plausible placeholder data for required fields if missing (e.g., "Main Street" for address if LocalBusiness), but mark them as PLACEHOLDER in comments.
      4. Return the JSON as a string.

      Output JSON format:
      {
        "schemaType": "The type of schema generated",
        "jsonLd": "The minified valid JSON-LD string",
        "explanation": "Brief explanation of why this schema helps SEO"
      }
    `;

        const { output } = await ai.generate(prompt);

        // Genkit's generate returns text or structured content. 
        // Since we didn't specify output format in generate() call strongly (only in flow definition), 
        // we should trust the model to follow the instructions or parse it.
        // Ideally update 'generate' to use structuredOutput if supported or parse the text.
        // For simplicity with Gemini 1.5 Flash which follows JSON instructions well:

        try {
            // Find JSON in the output text
            const text = output?.text || '';
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }
            throw new Error("No JSON found");
        } catch (e) {
            // Fallback
            return {
                schemaType: 'Error',
                jsonLd: '{}',
                explanation: 'Failed to generate schema.'
            };
        }
    }
);
