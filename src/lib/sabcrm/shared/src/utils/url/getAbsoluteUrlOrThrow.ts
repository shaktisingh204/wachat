import { absoluteUrlSchema } from '@/lib/sabcrm/shared/src/utils/url/absoluteUrlSchema';

export const getAbsoluteUrlOrThrow = (url: string): string => {
  try {
    return absoluteUrlSchema.parse(url);
  } catch {
    throw new Error('Invalid URL');
  }
};
