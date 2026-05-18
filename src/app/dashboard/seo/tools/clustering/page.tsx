'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruBadge } from '@/components/zoruui';
import { ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { Download, Layers, Play, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// Simple client-side clustering for demo (avoiding complex python backend for now)
// Groups by "common 2-word stems" or "intent words"
function clusterKeywords(keywords: string[]) {
    const clusters: Record<string, string[]> = {};
    const intents = ['buy', 'price', 'cost', 'cheap', 'best', 'review', 'vs', 'how', 'what', 'why', 'guide'];

    keywords.forEach(kw => {
        const lower = kw.toLowerCase().trim();
        if (!lower) return;

        let found = false;

        // 1. Intent Clustering
        for (const intent of intents) {
            if (lower.includes(intent)) {
                const key = `Intent: ${intent.charAt(0).toUpperCase() + intent.slice(1)}`;
                if (!clusters[key]) clusters[key] = [];
                clusters[key].push(kw);
                found = true;
                break;
            }
        }

        if (!found) {
            // 2. Topic Clustering (Naive: First word that isn't stopword)
            const parts = lower.split(' ');
            if (parts.length > 1) {
                const topic = parts[1].length > 3 ? parts[1] : parts[0];
                // Very naive, but shows the UI concept
                const key = `Topic: ${topic.charAt(0).toUpperCase() + topic.slice(1)}`;
                if (!clusters[key]) clusters[key] = [];
                clusters[key].push(kw);
            } else {
                if (!clusters['Uncategorized']) clusters['Uncategorized'] = [];
                clusters['Uncategorized'].push(kw);
            }
        }
    });
    return clusters;
}

export default function KeywordClusteringPage() {
    const [input, setInput] = useState('');
    const [results, setResults] = useState<Record<string, string[]> | null>(null);
    const [loading, setLoading] = useState(false);

    const handleCluster = async () => {
        if (!input.trim()) return;
        setLoading(true);
        // Simulate processing delay
        await new Promise(r => setTimeout(r, 1000));

        const keywords = input.split('\n').map(k => k.trim()).filter(k => k);
        const data = clusterKeywords(keywords);
        setResults(data);
        setLoading(false);
        toast({ title: "Clustering Complete", description: `Grouped ${keywords.length} keywords.` });
    };

    const handleExport = () => {
        if (!results) return;
        // Generate CSV
        let csv = 'Cluster,Keyword\n';
        Object.entries(results).forEach(([cluster, kws]) => {
            kws.forEach(kw => {
                csv += `"${cluster}","${kw}"\n`;
            });
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'keyword-clusters.csv';
        a.click();
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Layers className="h-8 w-8 text-primary" />
                        Keyword Clustering
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Group thousands of keywords into topical clusters for pSEO.
                    </p>
                </div>
                {results && (
                    <ZoruButton variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" /> Export CSV
                    </ZoruButton>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <ZoruCard className="h-full">
                    <ZoruCardHeader>
                        <ZoruCardTitle>ZoruInput Keywords</ZoruCardTitle>
                        <ZoruCardDescription>Paste your list (one per line).</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="h-full">
                        <ZoruTextarea
                            placeholder="best coffee machine&#10;cheap coffee maker&#10;how to brew coffee&#10;coffee machine reviews..."
                            className="h-[400px] font-mono"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <div className="mt-4 flex justify-end">
                            <ZoruButton onClick={handleCluster} disabled={loading || !input}>
                                {loading ? <Sparkles className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                Cluster Keywords
                            </ZoruButton>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard className="h-full flex flex-col">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Clusters</ZoruCardTitle>
                        <ZoruCardDescription>
                            {results
                                ? `${Object.keys(results).length} groups found.`
                                : "Results will appear here."}
                        </ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex-1 overflow-y-auto max-h-[500px]">
                        {!results ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-md">
                                Run clustering to see results.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(results).map(([cluster, kws]) => (
                                    <div key={cluster} className="space-y-2">
                                        <div className="flex items-center gap-2 sticky top-0 bg-background py-2 border-b z-10">
                                            <ZoruBadge variant="secondary">{kws.length}</ZoruBadge>
                                            <h3 className="font-semibold text-sm">{cluster}</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pl-2">
                                            {kws.map((kw, i) => (
                                                <div key={i} className="text-xs p-1 hover:bg-muted rounded text-muted-foreground">
                                                    {kw}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </div>
    );
}
