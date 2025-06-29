
'use server';
/**
 * @fileOverview A flow that translates text, either to a specified language or by detecting it from the user's WA ID.
 *
 * - intelligentTranslate - The main function for translation.
 * - detectLanguageFromWaId - A helper to get a language from a WhatsApp ID.
 * - IntelligentTranslateInput - The input type for the function.
 * - IntelligentTranslateOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Re-using detection logic from auto-reply flow.
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

export async function detectLanguageFromWaId(waId: string): Promise<string> {
    for (const code in countryCodeToLanguage) {
        if (waId.startsWith(code)) {
            return countryCodeToLanguage[code];
        }
    }
    return 'English'; // Default language
}

const IntelligentTranslateInputSchema = z.object({
  text: z.string().describe('The text to be translated.'),
  waId: z.string().optional().describe("The user's WhatsApp ID, used for automatic language detection if targetLanguage is not provided."),
  targetLanguage: z.string().optional().describe('The language to translate the text into. If not provided, it will be detected from the waId.'),
});
export type IntelligentTranslateInput = z.infer<typeof IntelligentTranslateInputSchema>;

const IntelligentTranslateOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
});
export type IntelligentTranslateOutput = z.infer<typeof IntelligentTranslateOutputSchema>;

export async function intelligentTranslate(input: IntelligentTranslateInput): Promise<IntelligentTranslateOutput> {
  return intelligentTranslateFlow(input);
}

// Prompt needs the final language determined.
const TranslatePromptInputSchema = z.object({
    text: z.string(),
    language: z.string(),
});

const prompt = ai.definePrompt({
  name: 'intelligentTranslatePrompt',
  input: {schema: TranslatePromptInputSchema},
  output: {schema: IntelligentTranslateOutputSchema},
  prompt: `Detect the language of the following text, and then translate it into {{{language}}}.

"{{{text}}}"

If the text is already in {{{language}}}, simply return the original text.
Only return the translated text, with no additional commentary or explanations. Preserve any variables that look like {{...}}.`,
});

const intelligentTranslateFlow = ai.defineFlow(
  {
    name: 'intelligentTranslateFlow',
    inputSchema: IntelligentTranslateInputSchema,
    outputSchema: IntelligentTranslateOutputSchema,
  },
  async (input) => {
    let finalLanguage = 'English';

    if (input.targetLanguage) {
        finalLanguage = input.targetLanguage;
    } else if (input.waId) {
        finalLanguage = await detectLanguageFromWaId(input.waId);
    }
    
    const {output} = await prompt({
        text: input.text,
        language: finalLanguage,
    });
    return output!;
  }
);
