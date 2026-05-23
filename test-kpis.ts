import { getDb } from '@/lib/mongo';

export async function getWsIssuesKpis() {
  const db = await getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const result = await db.collection('crm_issues').aggregate([
    {
      $facet: {
        open: [
          { $match: { status: { $nin: ['resolved', 'closed'] } } },
          { $count: 'count' }
        ],
        critical: [
          { $match: { 
            status: { $nin: ['resolved', 'closed'] }, 
            priority: 'urgent' 
          } },
          { $count: 'count' }
        ],
        resolvedThisMonth: [
          { $match: { 
            status: { $in: ['resolved', 'closed'] },
            updatedAt: { $gte: thirtyDaysAgo }
          } },
          { $count: 'count' },
        ],
        avgResolutionDays: [
          { $match: { 
            status: { $in: ['resolved', 'closed'] },
            createdAt: { $exists: true },
            updatedAt: { $exists: true }
          } },
          {
            $group: {
              _id: null,
              avgDiff: { 
                $avg: { 
                  $subtract: ['$updatedAt', '$createdAt'] 
                } 
              }
            }
          }
        ]
      }
    }
  ]).toArray();

  const r = result[0] || {};
  const openCount = r.open?.[0]?.count || 0;
  const criticalCount = r.critical?.[0]?.count || 0;
  const resolvedCount = r.resolvedThisMonth?.[0]?.count || 0;
  const avgResolutionMs = r.avgResolutionDays?.[0]?.avgDiff || 0;
  
  return {
    open: openCount,
    critical: criticalCount,
    resolvedThisMonth: resolvedCount,
    avgResolutionDays: avgResolutionMs > 0 ? Math.round(avgResolutionMs / (1000 * 60 * 60 * 24)) : 0
  };
}
