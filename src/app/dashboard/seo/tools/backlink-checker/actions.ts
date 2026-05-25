'use server';

import { getBacklinksData } from '@/lib/seo/data-for-seo';

export async function fetchBacklinks(domain: string, limit: number = 10) {
  try {
    const data = await getBacklinksData(domain, limit);
    return { data };
  } catch (error: any) {
    return { error: error.message || 'Failed to fetch backlinks' };
  }
}
