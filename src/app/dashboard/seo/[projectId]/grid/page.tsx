'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Map, Search, Play } from 'lucide-react';
import { startGridTracking } from '@/app/actions/seo.actions';
import { toast } from '@/hooks/use-toast';
import { use } from 'react';

// Simple Grid Visualization without Google Maps API Key for Demo
// In production, use @react-google-maps/api
function GridMap({ points }: { points: any[] }) {
    if (!points || points.length === 0) return (
        <div className="h-[400px] w-full bg-muted/20 border rounded-md flex items-center justify-center text-muted-foreground">
            Enter keyword and location to generate grid.
        </div>
    );

    // Normalize coordinates for simple SVG plotting
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return (
        <div className="h-[400px] w-full bg-slate-50 border rounded-md relative overflow-hidden p-8">
            <div className="absolute inset-0 grid grid-cols-3 gap-1 opacity-10 pointer-events-none">
                {/* Fake Map Background Pattern */}
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border bg-slate-200"></div>
                ))}
            </div>

            <div className="relative w-full h-full">
                {points.map((p, i) => {
                    // Simple projection to %
                    const y = ((p.lat - minLat) / (maxLat - minLat)) * 100;
                    const x = ((p.lng - minLng) / (maxLng - minLng)) * 100;

                    // Invert Y for CSS top
                    const top = 100 - y;
                    const left = x;

                    const color = p.rank === 0 ? 'bg-gray-400' : p.rank <= 3 ? 'bg-green-500' : p.rank <= 10 ? 'bg-yellow-500' : 'bg-red-500';

                    return (
                        <div
                            key={i}
                            className={`absolute w-10 h-10 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110 cursor-pointer border-2 border-white`}
                            style={{ top: `${top}%`, left: `${left}%` }}
                            title={`Rank: ${p.rank || '>20'}`}
                        >
                            {p.rank || '-'}
                        </div>
                    );
                })}
            </div>
            <div className="absolute bottom-4 right-4 bg-white p-2 rounded shadow text-xs flex flex-col gap-1">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> 1-3</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div> 4-10</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> 11+</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-400"></div> Not Found</div>
            </div>
        </div>
    );
}

export default function GridTrackingPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(false);
    const [points, setPoints] = useState<any[]>([]);

    async function handleScan() {
        if (!keyword) return;
        setLoading(true);
        // Using center of NYC for Demo: 40.7128, -74.0060
        // In real app, geocode the project address
        const result = await startGridTracking(projectId, keyword, 40.7128, -74.0060);

        if (result.success) {
            setPoints(result.points);
            toast({ title: "Scan Complete", description: "Grid updated successfully." });
        } else {
            toast({ title: "Scan Failed", description: result.error, variant: "destructive" });
        }
        setLoading(false);
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Map className="h-8 w-8 text-primary" />
                        Local SEO Grid
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Visualize your rankings across a geographical grid.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle>Scan Configuration</CardTitle>
                        <CardDescription>Setup your grid parameters.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Target Keyword</Label>
                            <Input
                                placeholder="e.g. coffee shop near me"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Grid Size</Label>
                            <Input disabled value="3x3 (10km radius)" />
                        </div>

                        <div className="space-y-2">
                            <Label>Center Location</Label>
                            {/* Hardcoded for demo, normally geocoded */}
                            <Input disabled value="New York, NY (Demo)" />
                        </div>

                        <Button className="w-full" onClick={handleScan} disabled={loading || !keyword}>
                            {loading ? 'Scanning...' : (
                                <>
                                    <Play className="h-4 w-4 mr-2" /> Start Scan
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Ranking Map</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <GridMap points={points} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
