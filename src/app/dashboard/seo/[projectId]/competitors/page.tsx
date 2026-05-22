'use client';

import { Button, Card, ZoruCardContent } from '@/components/zoruui';
import { use } from 'react';

import { Swords, Lock } from 'lucide-react';

export default function CompetitorsPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <Swords className="h-8 w-8 text-zoru-ink" />
                        Competitor Gap
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Analyze where competitors are beating you.</p>
                </div>
                <ZoruButton variant="outline">Add Competitor</ZoruButton>
            </div>

            <ZoruCard className="border-dashed bg-zoru-surface-2/50">
                <ZoruCardContent className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 rounded-full bg-zoru-bg p-4 shadow-[var(--zoru-shadow-sm)]">
                        <Swords className="h-10 w-10 text-zoru-ink-muted" />
                    </div>
                    <h3 className="text-xl text-zoru-ink mb-2">Gap Analysis Ready</h3>
                    <p className="text-zoru-ink-muted max-w-md mb-6">
                        We have identified 12 keywords where your competitor ranks in Top 3 but you are missing.
                    </p>

                    <div className="flex w-full max-w-md flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4">
                        <div className="flex items-center justify-between border-b border-zoru-line pb-2">
                            <span className="text-sm text-zoru-ink">Keyword</span>
                            <span className="text-sm text-zoru-ink">Vol</span>
                            <span className="text-sm text-zoru-ink">Diff</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-zoru-ink">best seo software</span>
                            <span className="text-zoru-ink">2.4k</span>
                            <span className="text-zoru-danger-ink">85</span>
                        </div>
                        <div className="flex items-center justify-between bg-zoru-surface-2/50 py-2">
                            <span className="text-zoru-ink">rank tracker tool</span>
                            <span className="text-zoru-ink">1.1k</span>
                            <span className="text-zoru-warning">62</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-zoru-ink">site audit checklist</span>
                            <span className="text-zoru-ink">800</span>
                            <span className="text-zoru-success">35</span>
                        </div>
                    </div>

                    <ZoruButton className="mt-8" disabled>
                        <Lock className="mr-2 h-4 w-4" />
                        Unlock Full Report (Premium)
                    </ZoruButton>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
