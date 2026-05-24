'use client';

import { 
    Button, 
    Card, 
    ZoruCardContent, 
    ZoruCardHeader, 
    ZoruCardTitle,
    ZoruCardDescription,
    Badge
} from '@/components/zoruui';
import { use, useState, useRef } from 'react';
import Papa from 'papaparse';

import { Database, Upload, Lock, Sparkles, Download, Layers, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

function clusterKeywordsFallback(keywords: string[]) {
    const clusters: Record<string, string[]> = {};
    const intents = ['buy', 'price', 'cost', 'cheap', 'best', 'review', 'vs', 'how', 'what', 'why', 'guide'];

    keywords.forEach(kw => {
        const lower = kw.toLowerCase().trim();
        if (!lower) return;

        let found = false;
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
            const parts = lower.split(' ');
            if (parts.length > 1) {
                const topic = parts[1].length > 3 ? parts[1] : parts[0];
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

export default function PseoPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);
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
                throw new Error('API unavailable, falling back to local heuristic clustering.');
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
                toast({ title: 'Clustering Complete', description: `Generated vector-based clusters successfully.` });
                return;
            }
            throw new Error('Invalid API response, falling back to local heuristic clustering.');
            
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.warn(msg);
            // Fallback to naive clustering
            const fallbackData = clusterKeywordsFallback(keywords);
            setClusters(fallbackData);
            toast({ title: 'Clustering Complete', description: `Grouped keywords (heuristic fallback).` });
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
                        <Database className="h-8 w-8 text-primary" />
                        pSEO Clustering
                    </h1>
                    <p className="text-muted-foreground mt-1">Group thousands of keywords by semantic intent.</p>
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
                                className={`flex cursor-pointer flex-col items-center justify-center rounded-[var(--zoru-radius)] border-2 border-dashed w-full h-full p-12 text-center transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                            >
                                <Upload className={`mb-4 h-10 w-10 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                                <h3 className="font-semibold mb-1">Click or drag CSV here</h3>
                                <p className="text-xs text-muted-foreground">Up to 10,000 rows (first column used)</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full h-full border rounded-md bg-muted/20 p-6 relative">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                                    onClick={handleClear}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Database className="mb-4 h-12 w-12 text-primary opacity-80" />
                                <h3 className="font-medium text-lg mb-1 truncate max-w-[200px]">{file.name}</h3>
                                <p className="text-sm text-muted-foreground mb-6">{keywords.length} keywords loaded</p>
                                
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
                            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed border-transparent bg-muted/20 rounded-md p-6">
                                <Lock className="mb-4 h-8 w-8 text-muted-foreground/50" />
                                <p className="text-sm">Vector processing required for clustering.</p>
                                <p className="text-xs opacity-70 mt-1">Upload a CSV to begin.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-4 pr-2">
                                {Object.entries(clusters).map(([cluster, kws]) => (
                                    <div key={cluster} className="space-y-2">
                                        <div className="flex items-center gap-2 sticky top-0 bg-background py-2 border-b z-10">
                                            <Badge variant="secondary">{kws.length}</Badge>
                                            <h3 className="font-semibold text-sm">{cluster}</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pl-2">
                                            {kws.map((kw, i) => (
                                                <div key={i} className="text-xs p-1.5 hover:bg-muted rounded text-muted-foreground border border-transparent hover:border-border transition-colors">
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
