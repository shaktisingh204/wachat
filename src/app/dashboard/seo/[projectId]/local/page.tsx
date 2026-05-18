'use client';

import { ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { use } from 'react';

import { MapPin, Search } from 'lucide-react';

const MOCK_GRID = [
    { rank: 1, color: 'bg-zoru-success' },
    { rank: 2, color: 'bg-zoru-success' },
    { rank: 4, color: 'bg-zoru-warning' },
    { rank: 1, color: 'bg-zoru-success' },
    { rank: 1, color: 'bg-zoru-success' },
    { rank: 3, color: 'bg-zoru-success' },
    { rank: 5, color: 'bg-zoru-warning' },
    { rank: 8, color: 'bg-zoru-warning' },
    { rank: 12, color: 'bg-zoru-danger' },
];

export default function LocalSeoPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <MapPin className="h-8 w-8 text-zoru-ink" />
                        Local Geo-Grid
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Track your rankings across specific neighborhoods.</p>
                </div>
                <ZoruButton>
                    <Search className="mr-2 h-4 w-4" />
                    New Scan
                </ZoruButton>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Rank Map: &quot;Coffee Shop&quot;</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex items-center justify-center bg-zoru-surface-2/50 p-8">
                        <div className="relative grid h-64 w-64 grid-cols-3 gap-2 rounded bg-zoru-surface-2 p-2">
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
                                <MapPin className="h-full w-full" />
                            </div>

                            {MOCK_GRID.map((node, i) => (
                                <div
                                    key={i}
                                    className={`${node.color} z-10 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[var(--zoru-shadow-sm)]`}
                                >
                                    {node.rank}
                                </div>
                            ))}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>How it works</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-4">
                        <p className="text-sm text-zoru-ink-muted">
                            We simulate GPS coordinates at multiple points around your business location.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-zoru-success"></div>
                            <span className="text-sm text-zoru-ink">Rank 1-3 (Dominating)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-zoru-warning"></div>
                            <span className="text-sm text-zoru-ink">Rank 4-10 (Visible)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-zoru-danger"></div>
                            <span className="text-sm text-zoru-ink">Rank 10+ (Invisible)</span>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </div>
    );
}
