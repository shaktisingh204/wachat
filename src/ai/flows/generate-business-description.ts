'use server';
/**
 * @fileOverview Provides AI-powered generation of business descriptions.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBusinessDescriptionInputSchema = z.object({
  topic: z.string().describe('The name, category, or brief idea of the business.'),
});
type GenerateBusinessDescriptionInput = z.infer<typeof GenerateBusinessDescriptionInputSchema>;

const GenerateBusinessDescriptionOutputSchema = z.object({
  description: z.string().describe('An optimized business description.'),
});
type GenerateBusinessDescriptionOutput = z.infer<typeof GenerateBusinessDescriptionOutputSchema>;

export async function generateBusinessDescription(input: GenerateBusinessDescriptionInput): Promise<GenerateBusinessDescriptionOutput> {
  return generateBusinessDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBusinessDescriptionPrompt',
  input: {schema: GenerateBusinessDescriptionInputSchema},
  output: {schema: GenerateBusinessDescriptionOutputSchema},
  prompt: `You are an AI assistant designed to help users create engaging and professional business descriptions for WhatsApp Business profiles.

  Based on the provided input, generate a concise, professional, and engaging business description that is under 512 characters. It should clearly state what the business does and entice customers.

  Business details: {{{topic}}}

  Generated Description:`,
});

const generateBusinessDescriptionFlow = ai.defineFlow(
  {
    name: 'generateBusinessDescriptionFlow',
    inputSchema: GenerateBusinessDescriptionInputSchema,
    outputSchema: GenerateBusinessDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
