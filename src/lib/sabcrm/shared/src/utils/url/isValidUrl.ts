import { absoluteUrlSchema } from '@/lib/sabcrm/shared/src/utils/url/absoluteUrlSchema';

export const isValidUrl = (url: string): boolean => {
  const result = absoluteUrlSchema.safeParse(url);

  return result.success;
};
