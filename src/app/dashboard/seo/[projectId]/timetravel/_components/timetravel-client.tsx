'use client';

import { Button, Card, CardBody, CardHeader, CardTitle, Input } from '@/components/sabcrm/20ui';
import { useState, useEffect, useMemo } from 'react';
import { History, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { fetchSnapshot } from '../actions';
import { diffLines, Change } from 'diff';

type Competitor = {
    id: string;
    url: string;
    lastChanged: string;
};

const formatHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/></g, '>\n<').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
};

export function TimeTravelClient({ projectId }: { projectId: string }) {

    const [competitors, setCompetitors] = useState<Competitor[]>([
        { id: '1', url: 'https://vercel.com/pricing', lastChanged: '2 days ago' },
        { id: '2', url: 'https://github.com/pricing', lastChanged: '5 days ago' },
    ]);
    const [newUrl, setNewUrl] = useState('');
    
    const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(competitors[0]);
    const [snapshotData, setSnapshotData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'summary' | 'full'>('summary');

    useEffect(() => {
        if (selectedCompetitor) {
            loadSnapshot(selectedCompetitor.url);
        }
    }, [selectedCompetitor]);

    async function loadSnapshot(url: string) {
        setLoading(true);
        setSnapshotData(null);
        setViewMode('summary');
        try {
            const data = await fetchSnapshot(url);
            if (data.success) {
                setSnapshotData(data);
                if (data.lastChanged && data.lastChanged !== 'Unknown') {
                    setCompetitors(prev => prev.map(c => 
                        c.url === url ? { ...c, lastChanged: data.lastChanged } : c
                    ));
                    if (selectedCompetitor && selectedCompetitor.url === url) {
                        setSelectedCompetitor(prev => prev ? { ...prev, lastChanged: data.lastChanged } : prev);
                    }
                }
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

    const fullDiff = useMemo(() => {
        if (!snapshotData || !snapshotData.html) return [];
        const prev = formatHtml(snapshotData.previousHtml || '');
        const curr = formatHtml(snapshotData.html || '');
        return diffLines(prev, curr);
    }, [snapshotData]);

    const renderSummaryDiff = () => {
        const titleDiff = diffLines(snapshotData.previousTitle || '', snapshotData.title || '');
        const h1Diff = diffLines(snapshotData.previousH1 || '', snapshotData.h1 || '');

        return (
            <div className="flex-1 overflow-auto rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-4 font-mono text-sm space-y-6">
                <div>
                    <div className="text-[var(--st-text-secondary)] mb-2">{"<!-- Title Changes -->"}</div>
                    {titleDiff.map((part, index) => (
                        <div key={index} className={part.added ? 'bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)]' : part.removed ? 'bg-[var(--st-danger)]/10 text-[var(--st-danger)] line-through' : 'text-[var(--st-text)]'}>
                            {part.added ? '+ ' : part.removed ? '- ' : '  '}{part.value}
                        </div>
                    ))}
                </div>
                <div>
                    <div className="text-[var(--st-text-secondary)] mb-2">{"<!-- H1 Changes -->"}</div>
                    {h1Diff.map((part, index) => (
                        <div key={index} className={part.added ? 'bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)]' : part.removed ? 'bg-[var(--st-danger)]/10 text-[var(--st-danger)] line-through' : 'text-[var(--st-text)]'}>
                            {part.added ? '+ ' : part.removed ? '- ' : '  '}{part.value}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderFullDiff = () => {
        return (
            <div className="flex-1 overflow-auto rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-4 font-mono text-xs whitespace-pre-wrap">
                {fullDiff.map((part, index) => {
                    const bgClass = part.added ? 'bg-[var(--st-status-ok)]/20 text-[var(--st-status-ok)]' : part.removed ? 'bg-[var(--st-danger)]/20 text-[var(--st-danger)]' : 'text-[var(--st-text)]/70';
                    const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
                    
                    // Add prefix to each line in this chunk
                    const lines = part.value.split('\n');
                    // Remove last empty string if it split cleanly on a newline
                    if (lines[lines.length - 1] === '') lines.pop();

                    return (
                        <span key={index} className={`block ${bgClass}`}>
                            {lines.map((line, i) => (
                                <div key={i}>{prefix}{line}</div>
                            ))}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
                        <History className="h-8 w-8 text-[var(--st-text)]" />
                        SERP Time Travel
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-1">Automated tracking of competitor page title changes and historical DOM snapshots.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="col-span-1 flex flex-col max-h-[800px]">
                    <CardHeader>
                        <CardTitle>Tracked Competitors</CardTitle>
                    </CardHeader>
                    <CardBody className="flex-1 flex flex-col gap-4 overflow-hidden">
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
                                        ? 'border-[var(--st-accent)] bg-[var(--st-bg-muted)]' 
                                        : 'border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 hover:bg-[var(--st-bg-muted)]'
                                    }`}
                                >
                                    <h4 className="text-[var(--st-text)] truncate" title={comp.url}>{comp.url.replace(/^https?:\/\//, '')}</h4>
                                    <p className="text-xs text-[var(--st-text-secondary)] mt-1">Last checked: {comp.lastChanged}</p>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>

                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>
                            {selectedCompetitor ? `Visual Diff: ${selectedCompetitor.url.replace(/^https?:\/\//, '')}` : 'Select a competitor'}
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="h-[700px] flex flex-col gap-4">
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-[var(--st-accent)]" />
                            </div>
                        ) : snapshotData?.error ? (
                            <div className="flex-1 flex items-center justify-center text-[var(--st-danger)]">
                                <p>Error: {snapshotData.error}</p>
                            </div>
                        ) : snapshotData ? (
                                <>
                                <div className="grid gap-4 md:grid-cols-2 mb-4 shrink-0">
                                    <div className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                                        <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase mb-1">Previous Snapshot ({snapshotData.lastChanged})</h3>
                                        <p className={`font-medium ${snapshotData.title !== snapshotData.previousTitle ? 'text-[var(--st-danger)] line-through' : 'text-[var(--st-text)]'}`}>
                                            {snapshotData.previousTitle}
                                        </p>
                                    </div>
                                    <div className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                                        <h3 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase mb-1">Current Snapshot</h3>
                                        <p className={`font-medium ${snapshotData.title !== snapshotData.previousTitle ? 'text-[var(--st-status-ok)]' : 'text-[var(--st-text)]'}`}>
                                            {snapshotData.title}
                                        </p>
                                    </div>
                                </div>

                                {viewMode === 'summary' ? renderSummaryDiff() : renderFullDiff()}
                                
                                {snapshotData && !snapshotData.error && (
                                    <div className="mt-4 flex justify-center shrink-0">
                                        <Button variant="outline" onClick={() => setViewMode(prev => prev === 'summary' ? 'full' : 'summary')}>
                                            {viewMode === 'summary' ? 'View Full HTML Side-by-Side' : 'View Summary Diff'} <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-[var(--st-text-secondary)]">
                                <p>Select a competitor to view diffs</p>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
