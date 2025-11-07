
'use server';

import { z } from 'zod';
import { generatePostSuggestions } from '@/ai/flows/generate-post-suggestions';
import { intelligentTranslate } from '@/ai/flows/intelligent-translate-flow';

const facebookDataSchema = z.object({
  facebookData: z.string().min(1, { message: 'Facebook data cannot be empty.' }),
});

export async function getSuggestions(prevState: any, formData: FormData) {
  const validatedFields = facebookDataSchema.safeParse({
    facebookData: formData.get('facebookData'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await generatePostSuggestions(validatedFields.data);
    return { suggestions: result.postSuggestions, errors: {} };
  } catch (error: any) {
    return {
      errors: { _form: [error.message] },
    };
  }
}

export async function handleTranslateMessage(text: string): Promise<{ translatedText?: string; error?: string }> {
    if (!text) {
        return { error: 'No text provided for translation.' };
    }
    try {
        const result = await intelligentTranslate({ text });
        return { translatedText: result.translatedText };
    } catch(e: any) {
        return { error: e.message || 'Translation failed.' };
    }
}
