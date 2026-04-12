'use client';

import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Radar, Bell } from 'lucide-react';

export default function BrandPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Radar className="h-8 w-8 text-primary" />
                        Brand Radar
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor sentiment and unlinked mentions across the web.
                    </p>
                </div>
                <Button variant="outline"><Bell className="mr-2 h-4 w-4" /> Configure Alerts</Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Sentiment Score</CardTitle>
                        <CardDescription>AI Analysis of last 100 mentions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-green-600">92%</div>
                        <p className="text-sm text-muted-foreground mt-1">Positive Sentiment</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>New Mentions</CardTitle>
                        <CardDescription>Last 7 Days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">14</div>
                        <p className="text-sm text-muted-foreground mt-1">+3 from previous week</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Share of Voice</CardTitle>
                        <CardDescription>vs Competitors</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">18%</div>
                        <p className="text-sm text-muted-foreground mt-1">Rank 3rd in niche</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Mentions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[
                            { title: "Top 10 SEO Tools for 2026", source: "TechCrunch", sentiment: "positive" },
                            { title: "Review: Is Project Titan worth it?", source: "SEOMaster", sentiment: "neutral" },
                            { title: "Why I switched from Ahrefs", source: "IndieHackers", sentiment: "positive" },
                        ].map((m, i) => (
                            <div key={i} className="flex items-center justify-between border p-4 rounded-lg">
                                <div>
                                    <h4 className="font-semibold">{m.title}</h4>
                                    <p className="text-sm text-muted-foreground">{m.source}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${m.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                                        m.sentiment === 'negative' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {m.sentiment}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
