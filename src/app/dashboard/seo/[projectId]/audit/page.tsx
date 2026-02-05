'use client';

import { useEffect, useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Play, RefreshCw, Loader2 } from 'lucide-react';
import { startAudit, getAuditStatus } from '@/app/actions/seo-audit.actions';
import { getLatestAudit } from '@/app/actions/seo.actions';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { AuditTable } from '@/components/wabasimplify/seo/audit-table';

export default function AuditPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);

    // State
    const [audit, setAudit] = useState<any>(null); // The Audit Object
    const [pages, setPages] = useState<any[]>([]); // The Crawled Pages
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const [progress, setProgress] = useState({ crawled: 0, total: 0 });

    const loadInitialData = async () => {
        setLoading(true);
        const data = await getLatestAudit(projectId);
        if (data) {
            setAudit(data);
            setPages(data.pages || []); // Backwards compat for MVP inline array
            // TODO: Fetch from audit_snapshots in Phase 1.5 if we move away from 'pages' array
            if (data.status === 'running' || data.status === 'pending') {
                setStatus('running');
            } else {
                setStatus('completed');
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        loadInitialData();
    }, [projectId]);

    // Polling Effect
    useEffect(() => {
        if (status !== 'running' || !audit?._id) return;

        const interval = setInterval(async () => {
            const res = await getAuditStatus(audit._id);
            if (res) {
                // Update stats
                setProgress({ crawled: res.crawledCount, total: 0 }); // Total Unknown for crawling

                if (res.status === 'completed' || res.status === 'failed') {
                    setStatus(res.status as any);
                    // Reload full data
                    loadInitialData();
                    toast({ title: "Audit Finished", description: `Processed ${res.crawledCount} pages.` });
                }
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [status, audit?._id]);

    const handleStartAudit = async () => {
        setStatus('running');
        toast({ title: "Starting Audit", description: "Queuing crawler jobs..." });

        try {
            const result = await startAudit(projectId);
            if (result.auditId) {
                // Set temporary audit object so polling starts
                setAudit({ _id: result.auditId, status: 'running', summary: {} });
                setPages([]);
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
            setStatus('idle');
        }
    };

    if (loading && !audit && status === 'idle') return <Skeleton className="h-[400px] w-full" />;

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <RefreshCw className={`h-8 w-8 text-primary ${status === 'running' ? 'animate-spin' : ''}`} />
                        Technical Audit
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Deep crawl analysis using distributed cloud workers.
                    </p>
                </div>
                <Button onClick={handleStartAudit} disabled={status === 'running'}>
                    {status === 'running' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    {status === 'running' ? 'Crawling...' : 'Start New Audit'}
                </Button>
            </div>

            {status === 'running' && (
                <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="p-6 flex items-center gap-4">
                        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                        <div className="flex-1">
                            <div className="flex justify-between mb-2">
                                <span className="font-semibold text-blue-900">Audit in Progress</span>
                                <span className="text-blue-700">{progress.crawled} Pages Crawled</span>
                            </div>
                            <Progress value={30} className="h-2 bg-blue-200 [&>div]:bg-blue-500" />
                            {/* Indeterminate or estimated progress */}
                        </div>
                    </CardContent>
                </Card>
            )}

            {!audit ? (
                <Card className="border-dashed py-12 flex flex-col items-center justify-center text-center">
                    <p className="text-muted-foreground mb-4">No audit history found.</p>
                    <Button onClick={handleStartAudit}>Start First Crawl</Button>
                </Card>
            ) : (
                <>
                    {/* Score Card */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-4xl font-bold">{audit.totalScore || 0}</span>
                                    <span className="text-muted-foreground">/ 100</span>
                                </div>
                                <Progress value={audit.totalScore || 0} className={`h-2 ${(audit.totalScore || 0) > 80 ? 'bg-green-100 [&>div]:bg-green-500' : 'bg-red-100 [&>div]:bg-red-500'}`} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Critical Errors</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-red-100 text-red-600">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{audit.summary?.criticalIssues || 0}</div>
                                    <p className="text-xs text-muted-foreground">Require attention</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium">Warnings</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{audit.summary?.warningIssues || 0}</div>
                                    <p className="text-xs text-muted-foreground">Optimization tips</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed Results */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Crawled Pages</CardTitle>
                            <CardDescription>Results from the latest crawl.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AuditTable pages={pages} />
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
