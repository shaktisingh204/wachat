'use client';

import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Search } from 'lucide-react';

const MOCK_GRID = [
    { rank: 1, color: 'bg-green-500' }, { rank: 2, color: 'bg-green-500' }, { rank: 4, color: 'bg-yellow-400' },
    { rank: 1, color: 'bg-green-500' }, { rank: 1, color: 'bg-green-500' }, { rank: 3, color: 'bg-green-500' },
    { rank: 5, color: 'bg-yellow-400' }, { rank: 8, color: 'bg-orange-400' }, { rank: 12, color: 'bg-red-500' },
];

export default function LocalSeoPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <MapPin className="h-8 w-8 text-primary" />
                        Local Geo-Grid
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track your rankings across specific neighborhoods.
                    </p>
                </div>
                <Button>
                    <Search className="mr-2 h-4 w-4" /> New Scan
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Rank Map: "Coffee Shop"</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center p-8 bg-muted/20">
                        {/* Visual Grid Simulation */}
                        <div className="grid grid-cols-3 gap-2 w-64 h-64 bg-slate-200 p-2 rounded relative">
                            {/* Map Background Placeholder */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                <MapPin className="h-full w-full" />
                            </div>

                            {MOCK_GRID.map((node, i) => (
                                <div key={i} className={`${node.color} flex items-center justify-center rounded-full text-white font-bold shadow-sm z-10 w-16 h-16`}>
                                    {node.rank}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>How it works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            We simulate GPS coordinates at multiple points around your business location.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            <span className="text-sm">Rank 1-3 (Dominating)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                            <span className="text-sm">Rank 4-10 (Visible)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                            <span className="text-sm">Rank 10+ (Invisible)</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
