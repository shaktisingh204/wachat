'use client';

import { Button, Card, CardBody, CardHeader, CardTitle, CardDescription, Textarea, Badge, cn } from '@/components/sabcrm/20ui';
import { useState } from 'react';

import { Download, Layers, Play, Sparkles, Copy, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

async function fetchSemanticTopics(kw: string): Promise<string[]> {
    try {
        const res = await apiFetchUrl(`https://api.datamuse.com/words?ml=${encodeURIComponent(kw)}&max=3`);
        if (res.body) {
            const data = JSON.parse(res.body);
            if (Array.isArray(data)) {
                return data.map((d: any) => d.word);
            }
        }
    } catch (e) {
        console.error("NLP error for", kw, e);
    }
    return [];
}

async function clusterKeywordsNLP(keywords: string[]) {
    const clusters: Record<string, string[]> = {};
    const kwTopics: Record<string, string[]> = {};

    // Process in batches of 5 to avoid overwhelming the proxy
    const batchSize = 5;
    for (let i = 0; i < keywords.length; i += batchSize) {
        const batch = keywords.slice(i, i + batchSize);
        await Promise.all(batch.map(async (kw) => {
            const topics = await fetchSemanticTopics(kw);
            kwTopics[kw] = topics;
        }));
        if (i + batchSize < keywords.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    const topicFreq: Record<string, number> = {};
    Object.values(kwTopics).forEach(topics => {
        topics.forEach(t => {
            topicFreq[t] = (topicFreq[t] || 0) + 1;
        });
    });

    keywords.forEach(kw => {
        const topics = kwTopics[kw] || [];
        let bestTopic = '';
        let bestFreq = 0;

        for (const t of topics) {
            // Must appear at least twice across all keywords to form a meaningful cluster
            if (topicFreq[t] > 1 && topicFreq[t] > bestFreq) {
                bestFreq = topicFreq[t];
                bestTopic = t;
            }
        }

        if (bestTopic) {
            const key = bestTopic.charAt(0).toUpperCase() + bestTopic.slice(1);
            if (!clusters[key]) clusters[key] = [];
            clusters[key].push(kw);
        } else {
            // Intent fallback or Uncategorized
            const intents = ['buy', 'price', 'cost', 'cheap', 'best', 'review', 'vs', 'how', 'what', 'why', 'guide'];
            const lower = kw.toLowerCase();
            let intentFound = '';
            for (const intent of intents) {
                if (lower.includes(intent)) {
                    intentFound = intent;
                    break;
                }
            }

            if (intentFound) {
                const key = `Intent: ${intentFound.charAt(0).toUpperCase() + intentFound.slice(1)}`;
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
    const [copied, setCopied] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleCluster = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setErrorMsg(null);
        setResults(null);
        
        try {
            const keywords = Array.from(new Set(input.split('\n').map(k => k.trim()).filter(k => k)));
            if (keywords.length === 0) {
                toast({ title: "No keywords", description: "Please enter some keywords.", variant: "destructive" });
                setLoading(false);
                return;
            }

            const data = await clusterKeywordsNLP(keywords);
            
            // Clean up single item clusters into Uncategorized to make it neater
            const finalData: Record<string, string[]> = {};
            const uncategorized = [...(data['Uncategorized'] || [])];
            
            Object.entries(data).forEach(([cluster, kws]) => {
                if (cluster !== 'Uncategorized') {
                    if (kws.length === 1 && !cluster.startsWith('Intent:')) {
                        uncategorized.push(kws[0]);
                    } else {
                        finalData[cluster] = kws;
                    }
                }
            });
            if (uncategorized.length > 0) {
                finalData['Uncategorized'] = uncategorized;
            }

            setResults(finalData);
            toast({ title: "Clustering Complete", description: `Grouped ${keywords.length} keywords using NLP.` });
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to cluster keywords.');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!results) return;
        let csv = 'Cluster,Keyword\n';
        Object.entries(results).forEach(([cluster, kws]) => {
            kws.forEach(kw => {
                csv += `"${cluster.replace(/"/g, '""')}","${kw.replace(/"/g, '""')}"\n`;
            });
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'keyword-clusters.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleCopy = () => {
        if (!results) return;
        let text = '';
        Object.entries(results).forEach(([cluster, kws]) => {
            text += `[${cluster}]\n`;
            kws.forEach(kw => {
                text += `${kw}\n`;
            });
            text += '\n';
        });

        navigator.clipboard.writeText(text.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Layers className="h-8 w-8 text-[var(--st-text)]" />
                        Keyword Clustering
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-1">
                        Group thousands of keywords into topical semantic clusters using NLP.
                    </p>
                </div>
                {results && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleCopy} className="whitespace-nowrap">
                            {copied ? <Check className="h-4 w-4 mr-2 text-[var(--st-text)]" /> : <Copy className="h-4 w-4 mr-2" />}
                            {copied ? 'Copied' : 'Copy Text'}
                        </Button>
                        <Button variant="outline" onClick={handleExport} className="whitespace-nowrap">
                            <Download className="h-4 w-4 mr-2" /> Export CSV
                        </Button>
                    </div>
                )}
            </div>

            {errorMsg && (
                <div className="p-4 rounded-md bg-[var(--st-bg-muted)] text-[var(--st-text)] border border-[var(--st-border)]">
                    {errorMsg}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle>Input Keywords</CardTitle>
                        <CardDescription>Paste your list (one per line).</CardDescription>
                    </CardHeader>
                    <CardBody className="h-full">
                        <Textarea
                            placeholder="best coffee machine&#10;cheap coffee maker&#10;how to brew coffee&#10;coffee machine reviews..."
                            className="h-[400px] font-mono"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <div className="mt-4 flex justify-end">
                            <Button onClick={handleCluster} disabled={loading || !input}>
                                {loading ? <Sparkles className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                Cluster Keywords
                            </Button>
                        </div>
                    </CardBody>
                </Card>

                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>Semantic Clusters</CardTitle>
                        <CardDescription>
                            {results
                                ? `${Object.keys(results).length} groups found.`
                                : "Results will appear here."}
                        </CardDescription>
                    </CardHeader>
                    <CardBody className="flex-1 overflow-y-auto max-h-[500px]">
                        {!results ? (
                            <div className="h-full flex items-center justify-center text-[var(--st-text-secondary)] border-2 border-dashed rounded-md p-6 text-center">
                                Run clustering to group keywords by semantic meaning.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(results).map(([cluster, kws]) => (
                                    <div key={cluster} className="space-y-2">
                                        <div className="flex items-center gap-2 sticky top-0 bg-[var(--st-bg-secondary)] py-2 border-b z-10">
                                            <Badge variant="secondary">{kws.length}</Badge>
                                            <h3 className="font-semibold text-sm">{cluster}</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                                            {kws.map((kw, i) => (
                                                <div key={i} className="text-xs p-1.5 bg-[var(--st-bg-muted)]/30 hover:bg-[var(--st-bg-muted)] rounded text-[var(--st-text-secondary)] border border-transparent hover:border-[var(--st-border)] transition-colors">
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
