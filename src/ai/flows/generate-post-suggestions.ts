'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating social media post suggestions based on Facebook data.
 *
 * The flow takes Facebook data as input and uses a language model to generate engaging post suggestions.
 * It exports:
 * - `generatePostSuggestions`: An async function to trigger the flow.
 * - `GeneratePostSuggestionsInput`: The input type for the flow.
 * - `GeneratePostSuggestionsOutput`: The output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema
const GeneratePostSuggestionsInputSchema = z.object({
  facebookData: z.string().describe('The Facebook data to generate post suggestions from.'),
});

export type GeneratePostSuggestionsInput = z.infer<typeof GeneratePostSuggestionsInputSchema>;

// Define the output schema
const GeneratePostSuggestionsOutputSchema = z.object({
  postSuggestions: z.array(z.string()).describe('An array of suggested social media posts.'),
});

export type GeneratePostSuggestionsOutput = z.infer<typeof GeneratePostSuggestionsOutputSchema>;

// Define the flow
const generatePostSuggestionsFlow = ai.defineFlow(
  {
    name: 'generatePostSuggestionsFlow',
    inputSchema: GeneratePostSuggestionsInputSchema,
    outputSchema: GeneratePostSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await generatePostSuggestionsPrompt(input);
    return output!;
  }
);

// Define the prompt
const generatePostSuggestionsPrompt = ai.definePrompt({
  name: 'generatePostSuggestionsPrompt',
  input: {schema: GeneratePostSuggestionsInputSchema},
  output: {schema: GeneratePostSuggestionsOutputSchema},
  prompt: `You are a social media expert. Given the following Facebook data, generate 3 engaging social media posts.\n\nFacebook Data: {{{facebookData}}}\n\nPost Suggestions:`,
});

/**
 * Generates social media post suggestions based on the provided Facebook data.
 * @param input The input containing the Facebook data.
 * @returns The output containing an array of suggested social media posts.
 */
export async function generatePostSuggestions(input: GeneratePostSuggestionsInput): Promise<GeneratePostSuggestionsOutput> {
  return generatePostSuggestionsFlow(input);
}
