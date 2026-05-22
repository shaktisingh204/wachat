'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { use } from 'react';

import { Database, Upload, Lock } from 'lucide-react';

export default function PseoPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <Database className="h-8 w-8 text-zoru-ink" />
                        pSEO Clustering
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Group thousands of keywords by semantic intent.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Upload Keywords</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="flex cursor-pointer flex-col items-center justify-center rounded-[var(--zoru-radius)] border-2 border-dashed border-zoru-line p-12 text-center transition-colors hover:bg-zoru-surface-2/50">
                            <Upload className="mb-4 h-10 w-10 text-zoru-ink-muted" />
                            <h3 className="text-zoru-ink mb-1">Upload CSV</h3>
                            <p className="text-xs text-zoru-ink-muted">Up to 10,000 rows</p>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard className="bg-zoru-surface-2/50">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Cluster Results</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex h-[200px] flex-col items-center justify-center text-center">
                        <Lock className="mb-4 h-8 w-8 text-zoru-ink-muted" />
                        <p className="mb-4 text-sm text-zoru-ink-muted">Vector processing required for clustering.</p>
                        <ZoruButton disabled>Start Clustering Job</ZoruButton>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </div>
    );
}
