'use client';

import { use, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, RefreshCw } from 'lucide-react';
import { getKeywords } from '@/app/actions/seo-rank.actions';
import { RankingsTable } from '@/components/wabasimplify/seo/rankings-table';
import { AddKeywordDialog } from '@/components/wabasimplify/seo/add-keyword-dialog';
import { Skeleton } from '@/components/ui/skeleton';

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
    }, [projectId]);

    const handleRefresh = () => loadData();

    if (loading && keywords.length === 0) return <Skeleton className="h-[400px] w-full" />;

    // Calc simple stats
    const trackedCount = keywords.length;
    const top3 = keywords.filter(k => k.currentRank > 0 && k.currentRank <= 3).length;
    const top10 = keywords.filter(k => k.currentRank > 0 && k.currentRank <= 10).length;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        Rank Rankings
                    </h1>
                    <p className="text-muted-foreground mt-1">
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

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Tracked Keywords</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{trackedCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Top 3 Rankings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{top3}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Top 10 Rankings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">{top10}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Visibility</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {trackedCount > 0 ? Math.round((top10 / trackedCount) * 100) : 0}%
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Keyword Positions</CardTitle>
                </CardHeader>
                <CardContent>
                    <RankingsTable keywords={keywords} onRefresh={loadData} />
                </CardContent>
            </Card>
        </div>
    );
}
