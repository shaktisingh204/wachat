import { SUBDOMAIN_PATTERN } from '@/lib/sabcrm/shared/src/constants/SubdomainPattern';

export const isValidTwentySubdomain = (subdomain: string): boolean => {
  return SUBDOMAIN_PATTERN.test(subdomain);
};
