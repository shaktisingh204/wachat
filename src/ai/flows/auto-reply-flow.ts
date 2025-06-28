
'use server';
/**
 * @fileOverview Generates an AI-powered auto-reply based on business context.
 *
 * - generateAutoReply - A function that handles the AI auto-reply process.
 * - AutoReplyInput - The input type for the generateAutoReply function.
 * - AutoReplyOutput - The return type for the generateAutoReply function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutoReplyInputSchema = z.object({
  incomingMessage: z.string().describe('The message received from the user.'),
  businessContext: z.string().describe('A paragraph of context about the business to help formulate a reply. It may include hours, services, location, etc.'),
});
export type AutoReplyInput = z.infer<typeof AutoReplyInputSchema>;

const AutoReplyOutputSchema = z.object({
  replyMessage: z.string().describe('The generated, helpful, and friendly reply to send to the user.'),
});
export type AutoReplyOutput = z.infer<typeof AutoReplyOutputSchema>;

export async function generateAutoReply(input: AutoReplyInput): Promise<AutoReplyOutput> {
  return autoReplyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autoReplyPrompt',
  input: {schema: AutoReplyInputSchema},
  output: {schema: AutoReplyOutputSchema},
  prompt: `You are a helpful and friendly AI assistant for a business. A customer has sent a message. Using the business context provided below, generate a helpful and concise reply.

  If the customer's question cannot be answered with the provided context, politely state that you are an AI assistant and a human will respond shortly.

  BUSINESS CONTEXT:
  {{{businessContext}}}

  CUSTOMER MESSAGE:
  "{{{incomingMessage}}}"

  YOUR REPLY:`,
});

const autoReplyFlow = ai.defineFlow(
  {
    name: 'autoReplyFlow',
    inputSchema: AutoReplyInputSchema,
    outputSchema: AutoReplyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
