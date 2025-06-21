// use server'
'use server';
/**
 * @fileOverview Provides AI-powered content suggestions for broadcast message templates.
 *
 * - suggestTemplateContent - A function that generates content suggestions based on a topic.
 * - SuggestTemplateContentInput - The input type for the suggestTemplateContent function.
 * - SuggestTemplateContentOutput - The return type for the suggestTemplateContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTemplateContentInputSchema = z.object({
  topic: z.string().describe('The general topic for the broadcast message template.'),
});
export type SuggestTemplateContentInput = z.infer<typeof SuggestTemplateContentInputSchema>;

const SuggestTemplateContentOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of content suggestions for the template.'),
});
export type SuggestTemplateContentOutput = z.infer<typeof SuggestTemplateContentOutputSchema>;

export async function suggestTemplateContent(input: SuggestTemplateContentInput): Promise<SuggestTemplateContentOutput> {
  return suggestTemplateContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'templateContentSuggestionsPrompt',
  input: {schema: SuggestTemplateContentInputSchema},
  output: {schema: SuggestTemplateContentOutputSchema},
  prompt: `You are an AI assistant designed to help users create engaging content for their WhatsApp broadcast message templates.

  Based on the provided topic, generate a list of content suggestions that are relevant, engaging, and appropriate for a broadcast message.

  Topic: {{{topic}}}

  Suggestions:`, // No Handlebars logic; straight-forward templating
});

const suggestTemplateContentFlow = ai.defineFlow(
  {
    name: 'suggestTemplateContentFlow',
    inputSchema: SuggestTemplateContentInputSchema,
    outputSchema: SuggestTemplateContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
