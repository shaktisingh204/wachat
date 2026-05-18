'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruProgress,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  use } from 'react';

import { AlertCircle, Play, RefreshCw, Loader2 } from 'lucide-react';
import { startAudit, getAuditStatus } from '@/app/actions/seo-audit.actions';
import { getLatestAudit } from '@/app/actions/seo.actions';
import { AuditTable } from '@/components/wabasimplify/seo/audit-table';

export default function AuditPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const { toast } = useZoruToast();

    const [audit, setAudit] = useState<any>(null);
    const [pages, setPages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const [progress, setProgress] = useState({ crawled: 0, total: 0 });

    const loadInitialData = async () => {
        setLoading(true);
        const data = await getLatestAudit(projectId);
        if (data) {
            setAudit(data);
            setPages(data.pages || []);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    useEffect(() => {
        if (status !== 'running' || !audit?._id) return;

        const interval = setInterval(async () => {
            const res = await getAuditStatus(audit._id);
            if (res) {
                setProgress({ crawled: res.crawledCount, total: 0 });

                if (res.status === 'completed' || res.status === 'failed') {
                    setStatus(res.status as any);
                    loadInitialData();
                    toast({ title: 'Audit Finished', description: `Processed ${res.crawledCount} pages.` });
                }
            }
        }, 2000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, audit?._id]);

    const handleStartAudit = async () => {
        setStatus('running');
        toast({ title: 'Starting Audit', description: 'Queuing crawler jobs...' });

        try {
            const result = await startAudit(projectId);
            if ((result as any).error) {
                setStatus('failed');
                toast({
                    title: 'Audit failed',
                    description: (result as any).error,
                    variant: 'destructive',
                });
                if ((result as any).auditId) {
                    setAudit({ _id: (result as any).auditId, status: 'failed', summary: {} });
                }
                return;
            }
            if ((result as any).success) {
                setStatus('completed');
                toast({
                    title: 'Audit finished',
                    description: (result as any).message || 'Audit completed.',
                });
                await loadInitialData();
                return;
            }
            if (result.auditId) {
                setAudit({ _id: result.auditId, status: 'running', summary: {} });
                setPages([]);
            }
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
            setStatus('idle');
        }
    };

    if (loading && !audit && status === 'idle') return <ZoruSkeleton className="h-[400px] w-full" />;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <RefreshCw className={`h-8 w-8 text-zoru-ink ${status === 'running' ? 'animate-spin' : ''}`} />
                        Technical Audit
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Deep crawl analysis using distributed cloud workers.</p>
                </div>
                <ZoruButton onClick={handleStartAudit} disabled={status === 'running'}>
                    {status === 'running' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    {status === 'running' ? 'Crawling...' : 'Start New Audit'}
                </ZoruButton>
            </div>

            {status === 'running' && (
                <ZoruCard className="bg-zoru-info/10 border-zoru-info/40">
                    <ZoruCardContent className="p-6 flex items-center gap-4">
                        <Loader2 className="h-8 w-8 text-zoru-info animate-spin" />
                        <div className="flex-1">
                            <div className="flex justify-between mb-2">
                                <span className="text-zoru-ink">Audit in Progress</span>
                                <span className="text-zoru-ink-muted">{progress.crawled} Pages Crawled</span>
                            </div>
                            <ZoruProgress value={30} className="h-2" />
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            )}

            {!audit ? (
                <ZoruCard className="border-dashed py-12 flex flex-col items-center justify-center text-center">
                    <p className="text-zoru-ink-muted mb-4">No audit history found.</p>
                    <ZoruButton onClick={handleStartAudit}>Start First Crawl</ZoruButton>
                </ZoruCard>
            ) : (
                <>
                    <div className="grid gap-6 md:grid-cols-3">
                        <ZoruCard>
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm">Overall Health</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-4xl text-zoru-ink">{audit.totalScore || 0}</span>
                                    <span className="text-zoru-ink-muted">/ 100</span>
                                </div>
                                <ZoruProgress value={audit.totalScore || 0} className="h-2" />
                            </ZoruCardContent>
                        </ZoruCard>

                        <ZoruCard>
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm">Critical Errors</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-zoru-danger/10 text-zoru-danger-ink">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-2xl text-zoru-ink">{audit.summary?.criticalIssues || 0}</div>
                                    <p className="text-xs text-zoru-ink-muted">Require attention</p>
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>

                        <ZoruCard>
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm">Warnings</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-zoru-warning/10 text-zoru-warning">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-2xl text-zoru-ink">{audit.summary?.warningIssues || 0}</div>
                                    <p className="text-xs text-zoru-ink-muted">Optimization tips</p>
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>
                    </div>

                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Crawled Pages</ZoruCardTitle>
                            <ZoruCardDescription>Results from the latest crawl.</ZoruCardDescription>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <AuditTable pages={pages} />
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            )}
        </div>
    );
}
