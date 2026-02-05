import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Mock Data Fetch
async function getStatusData(shareId: string) {
    if (shareId !== 'demo') return null;
    return {
        projectName: "Acme Corp",
        healthScore: 88,
        keywordsUp: 12,
        keywordsDown: 3,
        lastAudit: new Date().toLocaleDateString(),
        topKeywords: [
            { term: 'best widgets', rank: 3, change: 2 },
            { term: 'widget pricing', rank: 1, change: 0 },
            { term: 'buy widgets online', rank: 5, change: -1 }
        ]
    };
}

export default async function PublicStatusPage({ params }: { params: Promise<{ shareId: string }> }) {
    const { shareId } = await params;
    const data = await getStatusData(shareId);

    if (!data) return notFound();

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex justify-between items-center border-b pb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{data.projectName} SEO Status</h1>
                        <p className="text-slate-500 text-sm">Last Updated: {data.lastAudit}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-black text-emerald-600">{data.healthScore}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Health Score</div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rank Movement (Last 7 Days)</CardTitle>
                        </CardHeader>
                        <CardContent className="flex gap-8">
                            <div>
                                <div className="text-2xl font-bold text-green-600">+{data.keywordsUp}</div>
                                <div className="text-sm text-muted-foreground">Improved</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-red-600">-{data.keywordsDown}</div>
                                <div className="text-sm text-muted-foreground">Declined</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Top Keywords</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {data.topKeywords.map((k, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm border-b last:border-0 pb-2 last:pb-0">
                                        <span className="font-medium">{k.term}</span>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline">#{k.rank}</Badge>
                                            {k.change > 0 && <span className="text-green-600 text-xs">▲ {k.change}</span>}
                                            {k.change < 0 && <span className="text-red-600 text-xs">▼ {Math.abs(k.change)}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <footer className="text-center text-xs text-slate-400 mt-12">
                    Powered by Project Titan
                </footer>
            </div>
        </div>
    );
}
