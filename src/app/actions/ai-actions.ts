
'use server';

import { z } from 'zod';
import { generatePostSuggestions } from '@/ai/flows/generate-post-suggestions';

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
