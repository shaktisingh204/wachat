
'use server';
/**
 * @fileOverview A flow that translates text, either to a specified language or by detecting it from the user's WA ID.
 *
 * This file defines the `intelligentTranslate` function for translation and `detectLanguageFromWaId`
 * for language detection from a WhatsApp ID.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Re-using detection logic from auto-reply flow.
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
type IntelligentTranslateInput = z.infer<typeof IntelligentTranslateInputSchema>;

const IntelligentTranslateOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
});
type IntelligentTranslateOutput = z.infer<typeof IntelligentTranslateOutputSchema>;

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
Only return the translated text, with no additional commentary or explanations. Preserve any variables that look like \{{...}}.`,
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
