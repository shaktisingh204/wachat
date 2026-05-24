'use server';

import { connectToDatabase } from '@/lib/mongodb';
import type { GlobalSearchResult } from '@/types/platform';

export async function performGlobalSearch(query: string, page: number = 1, limit: number = 10): Promise<{ data: GlobalSearchResult[], total: number }> {
  if (!query) return { data: [], total: 0 };
  const { db } = await connectToDatabase();
  
  // Real implementation would search multiple collections or use Atlas Search.
  // For now, we mock searching in users or organizations collections.
  const regex = new RegExp(query, 'i');
  
  const skip = (page - 1) * limit;

  const [orgs, total] = await Promise.all([
    db.collection('platform_organizations').find({ name: regex }).skip(skip).limit(limit).toArray(),
    db.collection('platform_organizations').countDocuments({ name: regex })
  ]);

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

  return { data: results, total };
}
