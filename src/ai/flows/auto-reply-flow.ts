
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
  autoTranslate: z.boolean().optional().describe('Whether to automatically translate the reply to the user\'s language.'),
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
  // North America
  '1': 'English', // USA, Canada
  '52': 'Spanish', // Mexico

  // South America
  '54': 'Spanish', // Argentina
  '55': 'Portuguese', // Brazil
  '56': 'Spanish', // Chile
  '57': 'Spanish', // Colombia
  '58': 'Spanish', // Venezuela
  '591': 'Spanish', // Bolivia
  '593': 'Spanish', // Ecuador
  '595': 'Spanish', // Paraguay
  '598': 'Spanish', // Uruguay
  '500': 'English', // Falkland Islands
  '592': 'English', // Guyana
  '597': 'Dutch', // Suriname

  // Europe
  '7': 'Russian', // Russia, Kazakhstan
  '30': 'Greek', // Greece
  '31': 'Dutch', // Netherlands
  '32': 'French', // Belgium (also Dutch, German)
  '33': 'French', // France
  '34': 'Spanish', // Spain
  '36': 'Hungarian', // Hungary
  '39': 'Italian', // Italy
  '40': 'Romanian', // Romania
  '41': 'German', // Switzerland (also French, Italian)
  '43': 'German', // Austria
  '44': 'English', // UK
  '45': 'Danish', // Denmark
  '46': 'Swedish', // Sweden
  '47': 'Norwegian', // Norway
  '48': 'Polish', // Poland
  '49': 'German', // Germany
  '351': 'Portuguese', // Portugal
  '352': 'French', // Luxembourg (also German)
  '353': 'English', // Ireland
  '354': 'Icelandic', // Iceland
  '358': 'Finnish', // Finland
  '370': 'Lithuanian', // Lithuania
  '371': 'Latvian', // Latvia
  '372': 'Estonian', // Estonia
  '375': 'Russian', // Belarus
  '380': 'Ukrainian', // Ukraine
  '420': 'Czech', // Czech Republic
  '421': 'Slovak', // Slovakia

  // Asia
  '81': 'Japanese', // Japan
  '82': 'Korean', // South Korea
  '84': 'Vietnamese', // Vietnam
  '86': 'Chinese', // China
  '90': 'Turkish', // Turkey
  '91': 'Hindi', // India (has many languages)
  '92': 'Urdu', // Pakistan
  '93': 'Dari', // Afghanistan
  '94': 'Sinhala', // Sri Lanka
  '95': 'Burmese', // Myanmar
  '98': 'Persian', // Iran
  '60': 'Malay', // Malaysia
  '62': 'Indonesian', // Indonesia
  '63': 'Filipino', // Philippines
  '65': 'English', // Singapore
  '66': 'Thai', // Thailand
  '852': 'Chinese', // Hong Kong
  '853': 'Chinese', // Macau
  '886': 'Chinese', // Taiwan
  '961': 'Arabic', // Lebanon
  '962': 'Arabic', // Jordan
  '963': 'Arabic', // Syria
  '964': 'Arabic', // Iraq
  '965': 'Arabic', // Kuwait
  '966': 'Arabic', // Saudi Arabia
  '967': 'Arabic', // Yemen
  '968': 'Arabic', // Oman
  '971': 'Arabic', // UAE
  '972': 'Hebrew', // Israel
  '973': 'Arabic', // Bahrain
  '974': 'Arabic', // Qatar
  '975': 'Dzongkha', // Bhutan
  '976': 'Mongolian', // Mongolia
  '977': 'Nepali', // Nepal
  '992': 'Tajik', // Tajikistan
  '993': 'Turkmen', // Turkmenistan
  '994': 'Azerbaijani', // Azerbaijan
  '995': 'Georgian', // Georgia
  '996': 'Kyrgyz', // Kyrgyzstan
  '998': 'Uzbek', // Uzbekistan

  // Africa
  '20': 'Arabic', // Egypt
  '27': 'English', // South Africa (many languages)
  '212': 'Arabic', // Morocco
  '213': 'Arabic', // Algeria
  '216': 'Arabic', // Tunisia
  '218': 'Arabic', // Libya
  '221': 'French', // Senegal
  '225': 'French', // Ivory Coast
  '233': 'English', // Ghana
  '234': 'English', // Nigeria
  '237': 'French, English', // Cameroon
  '249': 'Arabic', // Sudan
  '251': 'Amharic', // Ethiopia
  '254': 'Swahili', // Kenya
  '255': 'Swahili', // Tanzania
  '256': 'English', // Uganda

  // Oceania
  '61': 'English', // Australia
  '64': 'English', // New Zealand
  '675': 'English', // Papua New Guinea
  '679': 'English', // Fiji
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
    const targetLanguage = (input.autoTranslate === true) ? detectLanguageFromWaId(input.userWaId) : 'English';
    
    const promptInput = {
        ...input,
        targetLanguage,
    };

    const {output} = await prompt(promptInput);
    return output!;
  }
);
