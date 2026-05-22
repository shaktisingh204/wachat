'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  use } from 'react';

import { Map, Play } from 'lucide-react';
import { startGridTracking } from '@/app/actions/seo.actions';

function GridMap({ points }: { points: any[] }) {
    if (!points || points.length === 0)
        return (
            <div className="flex h-[400px] w-full items-center justify-center rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2/50 text-zoru-ink-muted">
                Enter keyword and location to generate grid.
            </div>
        );

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return (
        <div className="relative h-[400px] w-full overflow-hidden rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-8">
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-1 opacity-10">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-zoru-line bg-zoru-surface-2"></div>
                ))}
            </div>

            <div className="relative h-full w-full">
                {points.map((p, i) => {
                    const y = ((p.lat - minLat) / (maxLat - minLat)) * 100;
                    const x = ((p.lng - minLng) / (maxLng - minLng)) * 100;
                    const top = 100 - y;
                    const left = x;
                    const color =
                        p.rank === 0
                            ? 'bg-zoru-ink-muted'
                            : p.rank <= 3
                              ? 'bg-zoru-success'
                              : p.rank <= 10
                                ? 'bg-zoru-warning'
                                : 'bg-zoru-danger';

                    return (
                        <div
                            key={i}
                            className={`absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 transform cursor-pointer rounded-full border-2 border-zoru-bg text-white flex items-center justify-center text-sm shadow-[var(--zoru-shadow-sm)] transition-all hover:scale-110 ${color}`}
                            style={{ top: `${top}%`, left: `${left}%` }}
                            title={`Rank: ${p.rank || '>20'}`}
                        >
                            {p.rank || '-'}
                        </div>
                    );
                })}
            </div>
            <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded bg-zoru-bg p-2 text-xs shadow-[var(--zoru-shadow-sm)]">
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-zoru-success"></div> 1-3
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-zoru-warning"></div> 4-10
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-zoru-danger"></div> 11+
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-zoru-ink-muted"></div> Not Found
                </div>
            </div>
        </div>
    );
}

export default function GridTrackingPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const { toast } = useZoruToast();
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(false);
    const [points, setPoints] = useState<any[]>([]);

    async function handleScan() {
        if (!keyword) return;
        setLoading(true);
        const result = await startGridTracking(projectId, keyword, 40.7128, -74.006);

        if (result.success) {
            setPoints(result.points);
            toast({ title: 'Scan Complete', description: 'Grid updated successfully.' });
        } else {
            toast({ title: 'Scan Failed', description: result.error, variant: 'destructive' });
        }
        setLoading(false);
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <Map className="h-8 w-8 text-zoru-ink" />
                        Local SEO Grid
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Visualize your rankings across a geographical grid.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
                <Card className="h-fit">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Scan Configuration</ZoruCardTitle>
                        <ZoruCardDescription>Setup your grid parameters.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-4">
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
                            <Input disabled value="New York, NY (Demo)" />
                        </div>

                        <Button className="w-full" onClick={handleScan} disabled={loading || !keyword}>
                            {loading ? (
                                'Scanning...'
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Start Scan
                                </>
                            )}
                        </Button>
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Ranking Map</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <GridMap points={points} />
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}
