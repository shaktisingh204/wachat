cat << 'INNER_EOF' >> src/app/actions/crm-india-gst.actions.ts

export async function getGstr2bTrend(limit: number): Promise<Array<{ period: string, itcAvailable: number, itcReversed: number }>> {
    const session = await getSession();
    if (!session?.user) return [];
    
    try {
        const { db } = await connectToDatabase();
        const trendDocs = await db.collection('crm_gstr2b_imports').find({ userId: new ObjectId(session.user._id) })
            .project({
                period: 1,
                periodMonth: 1,
                periodYear: 1,
                totalItcAvailable: 1,
                totalItcIneligible: 1,
            })
            .sort({ periodYear: -1, periodMonth: -1 })
            .limit(limit)
            .toArray();
            
        function sumItc(totals?: { igst: number; cgst: number; sgst: number; cess: number; }): number {
            if (!totals) return 0;
            return (totals.igst || 0) + (totals.cgst || 0) + (totals.sgst || 0) + (totals.cess || 0);
        }

        return trendDocs.map(d => ({
            period: d.period ?? '',
            itcAvailable: Math.round(sumItc(d.totalItcAvailable)),
            itcReversed: Math.round(sumItc(d.totalItcIneligible))
        })).reverse();
    } catch {
        return [];
    }
}
INNER_EOF
