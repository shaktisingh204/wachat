import { absoluteUrlSchema } from '@/lib/sabcrm/shared/src/utils/url/absoluteUrlSchema';

export const getUrlHostnameOrThrow = (url: string): string => {
  const result = absoluteUrlSchema.safeParse(url);

  if (!result.success) {
    throw new Error('Invalid URL');
  }

  try {
    const parsedUrl = new URL(result.data);
    return parsedUrl.hostname;
  } catch {
    throw new Error('Invalid URL');
  }
};
