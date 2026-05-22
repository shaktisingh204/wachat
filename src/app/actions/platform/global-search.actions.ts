'use server';

import { connectToDatabase } from '@/lib/mongodb';
import type { GlobalSearchResult } from '@/types/platform';

export async function performGlobalSearch(query: string): Promise<GlobalSearchResult[]> {
  if (!query) return [];
  const { db } = await connectToDatabase();
  
  // Real implementation would search multiple collections or use Atlas Search.
  // For now, we mock searching in users or organizations collections.
  const regex = new RegExp(query, 'i');
  const orgs = await db.collection('platform_organizations').find({ name: regex }).limit(5).toArray();
  const results: GlobalSearchResult[] = [];
  
  for (const org of orgs) {
    results.push({
      id: org._id.toString(),
      type: 'other',
      title: org.name,
      subtitle: `Organization - ${org.slug}`,
      url: `/dashboard/platform/org-switcher`,
      score: 1,
    });
  }

  return results;
}
