'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Input } from '@/components/zoruui';
import { use, useState, useEffect } from 'react';
import { History, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { fetchSnapshot } from './actions';

type Competitor = {
    id: string;
    url: string;
    lastChanged: string;
};

export default function TimeTravelPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    const [competitors, setCompetitors] = useState<Competitor[]>([
        { id: '1', url: 'https://vercel.com/pricing', lastChanged: '2 days ago' },
        { id: '2', url: 'https://github.com/pricing', lastChanged: '5 days ago' },
    ]);
    const [newUrl, setNewUrl] = useState('');
    
    const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(competitors[0]);
    const [snapshotData, setSnapshotData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (selectedCompetitor) {
            loadSnapshot(selectedCompetitor.url);
        }
    }, [selectedCompetitor]);

    async function loadSnapshot(url: string) {
        setLoading(true);
        setSnapshotData(null);
        try {
            const data = await fetchSnapshot(url);
            if (data.success) {
                setSnapshotData(data);
            } else {
                setSnapshotData({ error: data.error });
            }
        } catch (err) {
            setSnapshotData({ error: 'Failed to fetch snapshot.' });
        }
        setLoading(false);
    }

    const handleAddCompetitor = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUrl) return;
        const urlToUse = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
        const newComp = {
            id: Date.now().toString(),
            url: urlToUse,
            lastChanged: 'Just now'
        };
        setCompetitors([newComp, ...competitors]);
        setNewUrl('');
        setSelectedCompetitor(newComp);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <History className="h-8 w-8 text-zoru-ink" />
                        SERP Time Travel
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Automated tracking of competitor page title changes and historical DOM snapshots.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="col-span-1 flex flex-col max-h-[600px]">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Tracked Competitors</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <form onSubmit={handleAddCompetitor} className="flex gap-2">
                            <Input 
                                placeholder="https://example.com" 
                                value={newUrl} 
                                onChange={(e) => setNewUrl(e.target.value)}
                                className="flex-1"
                            />
                            <Button type="submit" size="icon"><Plus className="w-4 h-4" /></Button>
                        </form>
                        
                        <div className="space-y-2 overflow-y-auto pr-2">
                            {competitors.map((comp) => (
                                <div 
                                    key={comp.id}
                                    onClick={() => setSelectedCompetitor(comp)}
                                    className={`cursor-pointer rounded border p-3 transition-colors ${
                                        selectedCompetitor?.id === comp.id 
                                        ? 'border-zoru-brand bg-zoru-surface-2' 
                                        : 'border-zoru-line bg-zoru-surface-2/50 hover:bg-zoru-surface-2'
                                    }`}
                                >
                                    <h4 className="text-zoru-ink truncate" title={comp.url}>{comp.url.replace(/^https?:\/\//, '')}</h4>
                                    <p className="text-xs text-zoru-ink-muted mt-1">Last checked: {comp.lastChanged}</p>
                                </div>
                            ))}
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card className="col-span-2">
                    <ZoruCardHeader>
                        <ZoruCardTitle>
                            {selectedCompetitor ? `Visual Diff: ${selectedCompetitor.url.replace(/^https?:\/\//, '')}` : 'Select a competitor'}
                        </ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="h-[500px] flex flex-col gap-4">
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-zoru-brand" />
                            </div>
                        ) : snapshotData?.error ? (
                            <div className="flex-1 flex items-center justify-center text-zoru-danger-ink">
                                <p>Error: {snapshotData.error}</p>
                            </div>
                        ) : snapshotData ? (
                            <>
                                <div className="grid gap-4 md:grid-cols-2 mb-4">
                                    <div className="rounded border border-zoru-line bg-zoru-surface-2 p-3">
                                        <h3 className="text-xs font-semibold text-zoru-ink-muted uppercase mb-1">Previous Snapshot</h3>
                                        <p className="font-medium text-zoru-danger-ink line-through">{snapshotData.previousTitle}</p>
                                    </div>
                                    <div className="rounded border border-zoru-line bg-zoru-surface-2 p-3">
                                        <h3 className="text-xs font-semibold text-zoru-ink-muted uppercase mb-1">Current Snapshot</h3>
                                        <p className="font-medium text-zoru-success">{snapshotData.title}</p>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto rounded border border-zoru-line bg-zoru-surface-2/50 p-4 font-mono text-sm">
                                    <div className="space-y-1">
                                        <div className="text-zoru-ink-muted">...</div>
                                        
                                        <div className="text-zoru-ink-muted mt-4">{"<!-- Title Changes -->"}</div>
                                        <div className="text-zoru-ink">&lt;head&gt;</div>
                                        <div className="bg-zoru-danger/10 text-zoru-danger-ink line-through pl-4">
                                            - &lt;title&gt;{snapshotData.previousTitle}&lt;/title&gt;
                                        </div>
                                        <div className="bg-zoru-success/10 text-zoru-success pl-4">
                                            + &lt;title&gt;{snapshotData.title}&lt;/title&gt;
                                        </div>
                                        <div className="text-zoru-ink">&lt;/head&gt;</div>

                                        <div className="text-zoru-ink-muted mt-4">{"<!-- H1 Changes -->"}</div>
                                        <div className="bg-zoru-danger/10 text-zoru-danger-ink line-through">
                                            - &lt;h1&gt;{snapshotData.previousH1}&lt;/h1&gt;
                                        </div>
                                        <div className="bg-zoru-success/10 text-zoru-success">
                                            + &lt;h1&gt;{snapshotData.h1}&lt;/h1&gt;
                                        </div>
                                        <div className="text-zoru-ink-muted mt-4">...</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-zoru-ink-muted">
                                <p>Select a competitor to view diffs</p>
                            </div>
                        )}
                        
                        {snapshotData && !snapshotData.error && (
                            <div className="mt-4 flex justify-center">
                                <Button variant="outline">
                                    View Full HTML Side-by-Side <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}
