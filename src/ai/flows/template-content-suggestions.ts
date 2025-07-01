
// use server'
'use server';
/**
 * @fileOverview Provides AI-powered content suggestions for broadcast message templates.
 *
 * This file defines the `suggestTemplateContent` function, which generates content suggestions
 * for message templates based on a given topic.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestTemplateContentInputSchema = z.object({
  topic: z.string().describe('The general topic for the broadcast message template.'),
});
type SuggestTemplateContentInput = z.infer<typeof SuggestTemplateContentInputSchema>;

const SuggestTemplateContentOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of content suggestions for the template.'),
});
type SuggestTemplateContentOutput = z.infer<typeof SuggestTemplateContentOutputSchema>;

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
