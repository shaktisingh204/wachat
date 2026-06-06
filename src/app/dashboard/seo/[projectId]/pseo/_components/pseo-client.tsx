'use client';

import { 
    Button, 
    Card, 
    ZoruCardContent, 
    ZoruCardHeader, 
    ZoruCardTitle,
    ZoruCardDescription,
    Badge
} from '@/components/sabcrm/20ui/compat';
import { useState, useRef } from 'react';
import Papa from 'papaparse';

import { Database, Upload, Lock, Sparkles, Download, Layers, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
    const [file, setFile] = useState<File | null>(null);
    const [keywords, setKeywords] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [clusters, setClusters] = useState<Record<string, string[]> | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseFile = (uploaded: File) => {
        Papa.parse(uploaded, {
            header: false,
            complete: (results) => {
                const kws = (results.data as unknown[][]).map(row => String(row[0] || '')).filter(Boolean);
                if (kws.length === 0) {
                    toast({ title: 'Error', description: 'No valid keywords found in the first column.', variant: 'destructive' });
                    return;
                }
                setKeywords(kws);
                setFile(uploaded);
                setClusters(null); // reset clusters on new file
                toast({ title: 'CSV Loaded', description: `Found ${kws.length} keywords.` });
            },
            error: (err: unknown) => {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                toast({ title: 'Error', description: errorMsg, variant: 'destructive' });
            }
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploaded = e.target.files?.[0];
        if (!uploaded) return;
        parseFile(uploaded);
        // Reset input so the same file can be uploaded again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile && droppedFile.type === 'text/csv') {
            parseFile(droppedFile);
        } else if (droppedFile) {
            toast({ title: 'Invalid File', description: 'Please upload a valid CSV file.', variant: 'destructive' });
        }
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
                toast({ title: 'Clustering Complete', description: `Generated API vector-based clusters successfully.` });
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
            toast({ title: 'Clustering Complete', description: `Grouped keywords (local vector clustering).` });
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Database className="h-8 w-8 text-[var(--st-text)]" />
                        pSEO Clustering
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-1">Group thousands of keywords by semantic intent.</p>
                </div>
                {clusters && (
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" /> Export CSV
                    </Button>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="h-[400px] flex flex-col">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Upload Keywords</ZoruCardTitle>
                        <ZoruCardDescription>Upload a CSV file (one keyword per row)</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex-1 flex flex-col items-center justify-center">
                        <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        {!file ? (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`flex cursor-pointer flex-col items-center justify-center rounded-[var(--st-radius)] border-2 border-dashed w-full h-full p-12 text-center transition-colors ${isDragging ? 'border-primary bg-[var(--st-text)]/10' : 'border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/50'}`}
                            >
                                <Upload className={`mb-4 h-10 w-10 ${isDragging ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}`} />
                                <h3 className="font-semibold mb-1">Click or drag CSV here</h3>
                                <p className="text-xs text-[var(--st-text-secondary)]">Up to 10,000 rows (first column used)</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full border rounded-md bg-[var(--st-bg-muted)]/20 p-6 relative">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute top-2 right-2 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                    onClick={handleClear}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Database className="mb-4 h-12 w-12 text-[var(--st-text)] opacity-80" />
                                <h3 className="font-medium text-lg mb-1 truncate max-w-[200px]">{file.name}</h3>
                                <p className="text-sm text-[var(--st-text-secondary)] mb-6">{keywords.length} keywords loaded</p>
                                
                                <Button onClick={handleCluster} disabled={loading} size="lg" className="w-full max-w-[200px]">
                                    {loading ? <Sparkles className="h-4 w-4 mr-2 animate-spin" /> : <Layers className="h-4 w-4 mr-2" />}
                                    Start Clustering Job
                                </Button>
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>

                <Card className="h-[400px] flex flex-col">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Cluster Results</ZoruCardTitle>
                        <ZoruCardDescription>
                            {clusters
                                ? `${Object.keys(clusters).length} semantic groups found.`
                                : "Results will appear here."}
                        </ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex-1 overflow-y-auto min-h-0">
                        {!clusters ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-[var(--st-text-secondary)] border-2 border-dashed border-transparent bg-[var(--st-bg-muted)]/20 rounded-md p-6">
                                <Lock className="mb-4 h-8 w-8 text-[var(--st-text-secondary)]/50" />
                                <p className="text-sm">Vector processing required for clustering.</p>
                                <p className="text-xs opacity-70 mt-1">Upload a CSV to begin.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-4 pr-2">
                                {Object.entries(clusters).map(([cluster, kws]) => (
                                    <div key={cluster} className="space-y-2">
                                        <div className="flex items-center gap-2 sticky top-0 bg-[var(--st-bg-secondary)] py-2 border-b z-10">
                                            <Badge variant="secondary">{kws.length}</Badge>
                                            <h3 className="font-semibold text-sm">{cluster}</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pl-2">
                                            {kws.map((kw, i) => (
                                                <div key={i} className="text-xs p-1.5 hover:bg-[var(--st-bg-muted)] rounded text-[var(--st-text-secondary)] border border-transparent hover:border-[var(--st-border)] transition-colors">
                                                    {kw}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}
