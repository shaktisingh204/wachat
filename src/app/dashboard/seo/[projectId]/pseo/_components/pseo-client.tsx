'use client';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    Badge,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    useToast,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { useState } from 'react';
import Papa from 'papaparse';

import { Database, Lock, Sparkles, Download, Layers, Trash2 } from 'lucide-react';

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "is", "are", "was", "were", "it", "this", "that", "by", "from", "how", "what", "where", "when", "why"]);

function extractWords(text: string): string[] {
    return text.toLowerCase().split(/[\W_]+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));
}

function vectorBasedClustering(keywords: string[], similarityThreshold = 0.3): Record<string, string[]> {
    if (!keywords.length) return {};

    const termFreqs: Record<string, number>[] = [];
    const docFreq: Record<string, number> = {};

    keywords.forEach(kw => {
        const words = extractWords(kw);
        const finalWords = words.length > 0 ? words : kw.toLowerCase().split(/[\W_]+/).filter(w => w.length > 0);
        const tf: Record<string, number> = {};
        const unique = new Set<string>();
        for (const w of finalWords) {
            tf[w] = (tf[w] || 0) + 1;
            unique.add(w);
        }
        termFreqs.push(tf);
        for (const w of unique) {
            docFreq[w] = (docFreq[w] || 0) + 1;
        }
    });

    const N = keywords.length;
    const vocab = Object.keys(docFreq);
    const idf: Record<string, number> = {};
    for (const w of vocab) {
        idf[w] = Math.log(N / (1 + docFreq[w])) + 1;
    }

    const vectors: number[][] = [];
    for (const tf of termFreqs) {
        const vec = new Array(vocab.length).fill(0);
        let norm = 0;
        for (let i = 0; i < vocab.length; i++) {
            const w = vocab[i];
            if (tf[w]) {
                const val = tf[w] * idf[w];
                vec[i] = val;
                norm += val * val;
            }
        }
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < vocab.length; i++) {
            vec[i] /= norm;
        }
        vectors.push(vec);
    }

    interface Cluster {
        center: number[];
        indices: number[];
    }
    const clusters: Cluster[] = [];

    for (let i = 0; i < vectors.length; i++) {
        const vec = vectors[i];
        let bestClusterIdx = -1;
        let maxSim = -1;

        for (let j = 0; j < clusters.length; j++) {
            const center = clusters[j].center;
            let sim = 0;
            for (let k = 0; k < vocab.length; k++) {
                sim += vec[k] * center[k];
            }
            if (sim > maxSim) {
                maxSim = sim;
                bestClusterIdx = j;
            }
        }

        if (maxSim >= similarityThreshold && bestClusterIdx !== -1) {
            clusters[bestClusterIdx].indices.push(i);
            const c = clusters[bestClusterIdx];
            const newCount = c.indices.length;
            let norm = 0;
            for (let k = 0; k < vocab.length; k++) {
                c.center[k] = (c.center[k] * (newCount - 1) + vec[k]) / newCount;
                norm += c.center[k] * c.center[k];
            }
            norm = Math.sqrt(norm) || 1;
            for (let k = 0; k < vocab.length; k++) {
                c.center[k] /= norm;
            }
        } else {
            clusters.push({
                center: [...vec],
                indices: [i]
            });
        }
    }

    const result: Record<string, string[]> = {};
    for (const c of clusters) {
        const clusterKeywords = c.indices.map(idx => keywords[idx]);

        const center = c.center;
        const topWords = vocab
            .map((w, idx) => ({ word: w, score: center[idx] }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)
            .filter(x => x.score > 0)
            .map(x => x.word.charAt(0).toUpperCase() + x.word.slice(1));

        let clusterName = "Uncategorized";
        if (topWords.length > 0) {
            clusterName = topWords.join(" ");
        }

        let finalName = clusterName;
        let count = 1;
        while (result[finalName]) {
            count++;
            finalName = `${clusterName} (${count})`;
        }
        result[finalName] = clusterKeywords;
    }

    return result;
}

export function PseoClient({ projectId }: { projectId: string }) {
    void projectId;
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [clusters, setClusters] = useState<Record<string, string[]> | null>(null);

    const parseFile = (uploaded: File) => {
        Papa.parse(uploaded, {
            header: false,
            complete: (results) => {
                const kws = (results.data as unknown[][]).map(row => String(row[0] || '')).filter(Boolean);
                if (kws.length === 0) {
                    toast({ title: 'No keywords found', description: 'No valid keywords were found in the first column.', tone: 'danger' });
                    return;
                }
                setKeywords(kws);
                setFile(uploaded);
                setClusters(null); // reset clusters on new file
                toast({ title: 'CSV loaded', description: `Found ${kws.length} keywords.`, tone: 'success' });
            },
            error: (err: unknown) => {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                toast({ title: 'Could not read file', description: errorMsg, tone: 'danger' });
            }
        });
    };

    const handlePickFile = (picked: File) => {
        parseFile(picked);
    };

    const handleClear = () => {
        setFile(null);
        setKeywords([]);
        setClusters(null);
    };

    const handleCluster = async () => {
        if (!keywords.length) return;
        setLoading(true);

        try {
            // First attempt to use the real vector-based semantic clustering API
            const res = await fetch(`/api/v1/seo/ai/keyword-clusters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ keywords }),
            });

            if (!res.ok) {
                throw new Error('API unavailable, falling back to local vector clustering.');
            }

            const data = await res.json();

            let resultClusters: Record<string, string[]> | null = null;
            if (data && typeof data === 'object') {
                if (data.clusters) {
                    resultClusters = data.clusters;
                } else {
                    resultClusters = data;
                }
            }

            if (resultClusters && Object.keys(resultClusters).length > 0) {
                setClusters(resultClusters);
                toast({ title: 'Clustering complete', description: 'Generated API vector-based clusters successfully.', tone: 'success' });
                return;
            }
            throw new Error('Invalid API response, falling back to local vector clustering.');

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.warn(msg);
            // Fallback to local vector clustering
            await new Promise(r => setTimeout(r, 10)); // Allow UI to render loading state
            const fallbackData = vectorBasedClustering(keywords);
            setClusters(fallbackData);
            toast({ title: 'Clustering complete', description: 'Grouped keywords (local vector clustering).', tone: 'success' });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!clusters) return;
        // Generate CSV
        let csv = 'Cluster,Keyword\n';
        Object.entries(clusters).forEach(([cluster, kws]) => {
            kws.forEach(kw => {
                // Escape quotes in cluster or kw
                const escapedCluster = cluster.replace(/"/g, '""');
                const escapedKw = kw.replace(/"/g, '""');
                csv += `"${escapedCluster}","${escapedKw}"\n`;
            });
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pSEO-keyword-clusters.csv';
        a.click();
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle className="flex items-center gap-3">
                        <Database className="h-7 w-7 text-[var(--st-text)]" aria-hidden="true" />
                        pSEO Clustering
                    </PageTitle>
                    <PageDescription>Group thousands of keywords by semantic intent.</PageDescription>
                </PageHeaderHeading>
                {clusters && (
                    <PageActions>
                        <Button variant="outline" iconLeft={Download} onClick={handleExport}>
                            Export CSV
                        </Button>
                    </PageActions>
                )}
            </PageHeader>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="h-[400px] flex flex-col">
                    <CardHeader>
                        <CardTitle>Upload Keywords</CardTitle>
                        <CardDescription>Upload a CSV file (one keyword per row)</CardDescription>
                    </CardHeader>
                    <CardBody className="flex-1 flex flex-col items-center justify-center">
                        {!file ? (
                            <div className="flex w-full flex-col items-center justify-center gap-4 rounded-[var(--st-radius)] border-2 border-dashed border-[var(--st-border)] p-12 text-center">
                                <Database className="h-10 w-10 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                <div className="flex flex-col items-center gap-1">
                                    <h3 className="font-semibold text-[var(--st-text)]">Choose a CSV from SabFiles</h3>
                                    <p className="text-xs text-[var(--st-text-secondary)]">Up to 10,000 rows (first column used)</p>
                                </div>
                                <SabFileToFileButton
                                    accept="document"
                                    variant="default"
                                    onPickFile={handlePickFile}
                                    onError={(err: Error) => toast({ title: 'Could not load file', description: err.message, tone: 'danger' })}
                                >
                                    Choose CSV file
                                </SabFileToFileButton>
                            </div>
                        ) : (
                            <div className="relative flex h-full w-full flex-col items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-2 top-2"
                                    iconLeft={Trash2}
                                    onClick={handleClear}
                                >
                                    Clear
                                </Button>
                                <Database className="mb-4 h-12 w-12 text-[var(--st-text)] opacity-80" aria-hidden="true" />
                                <h3 className="mb-1 max-w-[200px] truncate text-lg font-medium text-[var(--st-text)]">{file.name}</h3>
                                <p className="mb-6 text-sm text-[var(--st-text-secondary)]">{keywords.length} keywords loaded</p>

                                <Button
                                    variant="primary"
                                    onClick={handleCluster}
                                    loading={loading}
                                    size="lg"
                                    iconLeft={loading ? Sparkles : Layers}
                                    className="w-full max-w-[200px]"
                                >
                                    Start Clustering Job
                                </Button>
                            </div>
                        )}
                    </CardBody>
                </Card>

                <Card className="h-[400px] flex flex-col">
                    <CardHeader>
                        <CardTitle>Cluster Results</CardTitle>
                        <CardDescription>
                            {clusters
                                ? `${Object.keys(clusters).length} semantic groups found.`
                                : "Results will appear here."}
                        </CardDescription>
                    </CardHeader>
                    <CardBody className="flex-1 min-h-0 overflow-y-auto">
                        {!clusters ? (
                            <div className="flex h-full items-center justify-center">
                                <EmptyState
                                    icon={Lock}
                                    title="Vector processing required for clustering."
                                    description="Choose a CSV from SabFiles to begin."
                                />
                            </div>
                        ) : (
                            <div className="space-y-6 pb-4 pr-2">
                                {Object.entries(clusters).map(([cluster, kws]) => (
                                    <div key={cluster} className="space-y-2">
                                        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] py-2">
                                            <Badge tone="accent">{kws.length}</Badge>
                                            <h3 className="text-sm font-semibold text-[var(--st-text)]">{cluster}</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pl-2">
                                            {kws.map((kw, i) => (
                                                <div key={i} className="rounded p-1.5 text-xs text-[var(--st-text-secondary)] transition-colors hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]">
                                                    {kw}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
