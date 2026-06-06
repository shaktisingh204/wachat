import { Card, CardBody, CardHeader, CardTitle, Badge } from '@/components/sabcrm/20ui/compat';
import {
  notFound } from 'next/navigation';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { SeoProject, SeoKeyword } from '@/lib/seo/definitions';
import { fmtDate } from '@/lib/utils';

// Mock Data Fetch
async function getStatusData(shareId: string) {
    if (!ObjectId.isValid(shareId)) {
        if (shareId === 'demo') {
            return {
                projectName: "Acme Corp (Demo)",
                healthScore: 88,
                keywordsUp: 12,
                keywordsDown: 3,
                lastAudit: fmtDate(new Date()),
                topKeywords: [
                    { term: 'best widgets', rank: 3, change: 2 },
                    { term: 'widget pricing', rank: 1, change: 0 },
                    { term: 'buy widgets online', rank: 5, change: -1 }
                ]
            };
        }
        return null;
    }

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection<SeoProject>('seo_projects').findOne({ _id: new ObjectId(shareId) });
        if (!project) return null;

        const keywords = await db.collection<SeoKeyword>('seo_keywords').find({ projectId: new ObjectId(shareId) }).toArray();

        let keywordsUp = 0;
        let keywordsDown = 0;
        const allKeywords = [];

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        for (const k of keywords) {
            if (k.currentRank == null) continue;

            let change = 0;
            if (k.history && k.history.length > 0) {
                // Find the oldest history entry within the last 7 days
                const recentHistory = k.history
                    .filter(h => new Date(h.date) >= sevenDaysAgo)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                if (recentHistory.length > 0) {
                    const prevRank = recentHistory[0].rank;
                    change = prevRank - k.currentRank;
                } else {
                    // If no history in last 7 days, just use the most recent one if available
                    const sortedHistory = k.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    if (sortedHistory.length > 1) {
                        change = sortedHistory[1].rank - k.currentRank;
                    }
                }
            }

            if (change > 0) keywordsUp++;
            if (change < 0) keywordsDown++;

            allKeywords.push({
                term: k.keyword,
                rank: k.currentRank,
                change
            });
        }

        allKeywords.sort((a, b) => a.rank - b.rank);
        const topKeywords = allKeywords.slice(0, 5); // Keep top 5

        return {
            projectName: project.domain || 'Unnamed Project',
            healthScore: project.healthScore || 0,
            keywordsUp,
            keywordsDown,
            lastAudit: project.lastAuditDate ? fmtDate(project.lastAuditDate) : 'Never',
            topKeywords
        };
    } catch (e) {
        console.error("Error fetching status data:", e);
        return null;
    }
}

export default async function PublicStatusPage({ params }: { params: Promise<{ shareId: string }> }) {
    const { shareId } = await params;
    const data = await getStatusData(shareId);

    if (!data) return notFound();

    return (
        <div className="min-h-screen bg-[var(--st-bg-muted)] p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex justify-between items-center border-b pb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--st-text)]">{data.projectName} SEO Status</h1>
                        <p className="text-[var(--st-text)] text-sm">Last Updated: {data.lastAudit}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-black text-[var(--st-text)]">{data.healthScore}</div>
                        <div className="text-xs text-[var(--st-text-secondary)] uppercase tracking-wider font-semibold">Health Score</div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rank Movement (Last 7 Days)</CardTitle>
                        </CardHeader>
                        <CardBody className="flex gap-8">
                            <div>
                                <div className="text-2xl font-bold text-[var(--st-text)]">+{data.keywordsUp}</div>
                                <div className="text-sm text-[var(--st-text-secondary)]">Improved</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-[var(--st-text)]">-{data.keywordsDown}</div>
                                <div className="text-sm text-[var(--st-text-secondary)]">Declined</div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Keywords</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="space-y-3">
                                {data.topKeywords.map((k, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm border-b last:border-0 pb-2 last:pb-0">
                                        <span className="font-medium">{k.term}</span>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline">#{k.rank}</Badge>
                                            {k.change > 0 && <span className="text-[var(--st-text)] text-xs">▲ {k.change}</span>}
                                            {k.change < 0 && <span className="text-[var(--st-text)] text-xs">▼ {Math.abs(k.change)}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </div>

                <footer className="text-center text-xs text-[var(--st-text-secondary)] mt-12">
                    Powered by Project Titan
                </footer>
            </div>
        </div>
    );
}
