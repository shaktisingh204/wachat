
'use server';
/**
 * @fileOverview Generates an AI-powered auto-reply based on business context, with language detection.
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
  userWaId: z.string().describe("The user's WhatsApp ID (phone number), used for language detection."),
});
export type AutoReplyInput = z.infer<typeof AutoReplyInputSchema>;

const AutoReplyOutputSchema = z.object({
  replyMessage: z.string().describe('The generated, helpful, and friendly reply to send to the user.'),
});
export type AutoReplyOutput = z.infer<typeof AutoReplyOutputSchema>;

export async function generateAutoReply(input: AutoReplyInput): Promise<AutoReplyOutput> {
  return autoReplyFlow(input);
}

const countryCodeToLanguage: Record<string, string> = {
    '91': 'Hindi',
    '52': 'Spanish', // Mexico
    '54': 'Spanish', // Argentina
    '34': 'Spanish', // Spain
    '55': 'Portuguese', // Brazil
    '351': 'Portuguese', // Portugal
    '33': 'French',
    '49': 'German',
    '39': 'Italian',
    '7': 'Russian',
    '86': 'Chinese',
    '81': 'Japanese',
    '1': 'English', // USA/Canada
    '44': 'English', // UK
};

function detectLanguageFromWaId(waId: string): string {
    for (const code in countryCodeToLanguage) {
        if (waId.startsWith(code)) {
            return countryCodeToLanguage[code];
        }
    }
    return 'English'; // Default language
}

// Define a new schema for the prompt itself, which includes the language.
const AutoReplyPromptInputSchema = AutoReplyInputSchema.extend({
    targetLanguage: z.string(),
});


const prompt = ai.definePrompt({
  name: 'autoReplyPrompt',
  input: {schema: AutoReplyPromptInputSchema},
  output: {schema: AutoReplyOutputSchema},
  prompt: `You are a helpful and friendly AI assistant for a business. A customer has sent a message.
  
  Your primary task is to generate a helpful and concise reply in the specified target language: {{targetLanguage}}.

  Use the provided business context to answer the customer's question.

  If the customer's question cannot be answered with the provided context, politely state that you are an AI assistant and a human will respond shortly. This fallback message must also be in {{targetLanguage}}.

  BUSINESS CONTEXT:
  {{{businessContext}}}

  CUSTOMER MESSAGE:
  "{{{incomingMessage}}}"

  YOUR REPLY (in {{targetLanguage}}):`,
});

const autoReplyFlow = ai.defineFlow(
  {
    name: 'autoReplyFlow',
    inputSchema: AutoReplyInputSchema,
    outputSchema: AutoReplyOutputSchema,
  },
  async input => {
    const targetLanguage = detectLanguageFromWaId(input.userWaId);
    
    const promptInput = {
        ...input,
        targetLanguage,
    };

    const {output} = await prompt(promptInput);
    return output!;
  }
);
