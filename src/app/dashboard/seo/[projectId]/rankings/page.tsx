'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Skeleton } from '@/components/zoruui';
import {
  use,
  useEffect,
  useState } from 'react';

import { TrendingUp, RefreshCw } from 'lucide-react';
import { getKeywords } from '@/app/actions/seo-rank.actions';
import { RankingsTable } from '@/components/wabasimplify/seo/rankings-table';
import { AddKeywordDialog } from '@/components/wabasimplify/seo/add-keyword-dialog';

export default function RankingsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const [keywords, setKeywords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        const data = await getKeywords(projectId);
        setKeywords(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const handleRefresh = () => loadData();

    if (loading && keywords.length === 0) return <Skeleton className="h-[400px] w-full" />;

    const trackedCount = keywords.length;
    const top3 = keywords.filter((k) => k.currentRank > 0 && k.currentRank <= 3).length;
    const top10 = keywords.filter((k) => k.currentRank > 0 && k.currentRank <= 10).length;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-zoru-ink" />
                        Rank Rankings
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">
                        Track your daily search performance across multiple locations.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <AddKeywordDialog projectId={projectId} onAdded={loadData} />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <ZoruCardHeader className="pb-2">
                        <ZoruCardTitle className="text-sm">Tracked Keywords</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-ink">{trackedCount}</div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardHeader className="pb-2">
                        <ZoruCardTitle className="text-sm">Top 3 Rankings</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-success">{top3}</div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardHeader className="pb-2">
                        <ZoruCardTitle className="text-sm">Top 10 Rankings</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-success">{top10}</div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardHeader className="pb-2">
                        <ZoruCardTitle className="text-sm">Avg. Visibility</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-2xl text-zoru-info">
                            {trackedCount > 0 ? Math.round((top10 / trackedCount) * 100) : 0}%
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Keyword Positions</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <RankingsTable keywords={keywords} onRefresh={loadData} />
                </ZoruCardContent>
            </Card>
        </div>
    );
}
