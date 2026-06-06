'use client';

import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label, useToast } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { MapPin, Play, Search, Map as MapIcon } from 'lucide-react';
import { startGridTracking, getSeoProject, updateSeoProjectSettings } from '@/app/actions/seo.actions';
import GoogleMapReact from 'google-map-react';

const Marker = ({ rank, lat, lng }: { rank: number; lat: number; lng: number }) => {
    const color =
        rank === 0
            ? 'bg-[var(--st-text-secondary)]'
            : rank <= 3
              ? 'bg-[var(--st-status-ok)]'
              : rank <= 10
                ? 'bg-[var(--st-warn)]'
                : 'bg-[var(--st-danger)]';

    return (
        <div
            className={`absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 transform cursor-pointer rounded-full border-2 border-[var(--st-bg)] text-white flex items-center justify-center text-sm shadow-[var(--st-shadow-sm)] transition-all hover:scale-110 ${color}`}
            title={`Rank: ${rank || '>20'}`}
        >
            {rank || '-'}
        </div>
    );
};

function GridMap({ points, center, loading, onMapClick }: { points: any[], center: { lat: number, lng: number }, loading: boolean, onMapClick?: (e: { lat: number, lng: number }) => void }) {
    if (loading) {
        return (
            <div className="flex h-[500px] w-full items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 text-[var(--st-text-secondary)]">
                Scanning grid area...
            </div>
        );
    }

    return (
        <div className="relative h-[500px] w-full overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]">
            <GoogleMapReact
                bootstrapURLKeys={{ key: '' }}
                defaultCenter={center}
                defaultZoom={11}
                center={center}
                onClick={onMapClick}
            >
                {/* Center marker */}
                <div
                    // @ts-ignore
                    lat={center.lat}
                    lng={center.lng}
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-[var(--st-text)] border-2 border-white shadow z-10"
                    title="Center Coordinates"
                />

                {points?.map((p, i) => (
                    <Marker key={i} lat={p.lat} lng={p.lng} rank={p.rank} />
                ))}
            </GoogleMapReact>
            
            <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded bg-[var(--st-bg)] p-3 text-xs shadow-[var(--st-shadow-sm)]">
                <div className="mb-1 font-semibold text-[var(--st-text)]">Rank Legend</div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[var(--st-status-ok)]"></div> 1-3 (Dominating)
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[var(--st-warn)]"></div> 4-10 (Visible)
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[var(--st-danger)]"></div> 11+ (Invisible)
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[var(--st-text-secondary)]"></div> Not Found
                </div>
            </div>
        </div>
    );
}

export function GridTrackingClient({ projectId, initialProj }: { projectId: string, initialProj: any }) {
    const { toast } = useToast();
    
    // Dynamic settings states
    const [keyword, setKeyword] = useState('');
    const [lat, setLat] = useState(initialProj?.settings?.gridSettings?.lat || 40.7128);
    const [lng, setLng] = useState(initialProj?.settings?.gridSettings?.lng || -74.006);
    const [radius, setRadius] = useState(initialProj?.settings?.gridSettings?.radius || 10);
    const [gridSize, setGridSize] = useState(initialProj?.settings?.gridSettings?.gridSize || 3);
    
    const [loading, setLoading] = useState(false);
    const [points, setPoints] = useState<any[]>([]);

    async function handleScan() {
        if (!keyword) return;
        setLoading(true);
        // Call updated startGridTracking with radius and gridSize
        const result = await startGridTracking(projectId, keyword, lat, lng, radius, gridSize);

        if (result.success) {
            setPoints(result.points);
            toast({ title: 'Scan Complete', description: 'Local geo-grid updated successfully.' });
            
            // Save configuration as default for user
            await updateSeoProjectSettings(projectId, { 
                gridSettings: { lat, lng, radius, gridSize } 
            });
        } else {
            toast({ title: 'Scan Failed', description: result.error || 'Failed to scan.', variant: 'destructive' });
        }
        setLoading(false);
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
                        <MapPin className="h-8 w-8 text-[var(--st-text)]" />
                        Local Geo-Grid
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-1">Visualize and track your local rankings across specific neighborhoods.</p>
                </div>
                <Button onClick={handleScan} disabled={loading || !keyword}>
                    <Search className="mr-2 h-4 w-4" />
                    New Scan
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-[350px_1fr]">
                <div className="flex flex-col gap-6">
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Scan Configuration</CardTitle>
                            <CardDescription>Setup your local grid parameters.</CardDescription>
                        </CardHeader>
                        <CardBody className="space-y-4">
                            <div className="space-y-2">
                                <Label>Target Keyword</Label>
                                <Input
                                    placeholder="e.g. coffee shop near me"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Grid Size</Label>
                                    <Input 
                                        type="number" 
                                        min={3} 
                                        max={15} 
                                        step={2} 
                                        value={gridSize} 
                                        onChange={(e) => setGridSize(parseInt(e.target.value) || 3)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Radius (km)</Label>
                                    <Input 
                                        type="number" 
                                        min={1} 
                                        max={100} 
                                        value={radius} 
                                        onChange={(e) => setRadius(parseInt(e.target.value) || 10)} 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Latitude</Label>
                                    <Input 
                                        type="number" 
                                        step="any" 
                                        value={lat} 
                                        onChange={(e) => setLat(parseFloat(e.target.value) || 0)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Longitude</Label>
                                    <Input 
                                        type="number" 
                                        step="any" 
                                        value={lng} 
                                        onChange={(e) => setLng(parseFloat(e.target.value) || 0)} 
                                    />
                                </div>
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
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>How it works</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <p className="text-sm text-[var(--st-text-secondary)]">
                                We simulate GPS coordinates at multiple points around your business location in a grid pattern. This reveals exactly where you rank in local search results across different neighborhoods.
                            </p>
                        </CardBody>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Rank Map</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <GridMap 
                            points={points} 
                            center={{ lat, lng }} 
                            loading={loading} 
                            onMapClick={(e) => {
                                setLat(e.lat);
                                setLng(e.lng);
                            }}
                        />
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}

