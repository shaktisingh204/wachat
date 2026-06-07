'use client';

import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Progress, Skeleton, useToast } from '@/components/sabcrm/20ui';
import { useEffect, useState, use } from 'react';

import { AlertCircle, Play, RefreshCw, Loader2, Download, Printer, Calendar, ArrowRight } from 'lucide-react';
import { startAudit, getAuditStatus } from '@/app/actions/seo-audit.actions';
import { getLatestAudit, getAuditHistory, updateSeoProjectSettings } from '@/app/actions/seo.actions';
import { AuditTable } from '@/components/20ui-domain/seo/audit-table';
import { AuditDiffViewer } from '@/components/20ui-domain/seo/audit-diff-viewer';
import { SeoAudit, SeoPageAudit } from '@/lib/seo/definitions';

type ClientSeoAudit = Omit<SeoAudit, '_id' | 'projectId'> & { _id: string; projectId: string };
type ClientSeoPageAudit = Omit<SeoPageAudit, 'crawledAt'> & { crawledAt: string | Date };

export function AuditPageClient({ projectId, initialHistory }: { projectId: string, initialHistory: ClientSeoAudit[] }) {
    const { toast } = useToast();

    const [audit, setAudit] = useState<ClientSeoAudit | null>(initialHistory.length > 0 ? initialHistory[0] : null);
    const [pages, setPages] = useState<ClientSeoPageAudit[]>(initialHistory.length > 0 ? (initialHistory[0].pages as unknown as ClientSeoPageAudit[]) || [] : []);
    const [pastAudits, setPastAudits] = useState<ClientSeoAudit[]>(initialHistory.length > 1 ? initialHistory.slice(1) : []);
    const [loading, setLoading] = useState(false);
    const [scheduling, setScheduling] = useState(false);
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>(
        initialHistory.length > 0 ? (initialHistory[0].status === 'running' || initialHistory[0].status === 'pending' ? 'running' : 'completed') : 'idle'
    );
    const [progress, setProgress] = useState({ crawled: 0, total: 0 });

    const loadInitialData = async () => {
        setLoading(true);
        const history = await getAuditHistory(projectId, 2) as ClientSeoAudit[];
        
        if (history && history.length > 0) {
            const data = history[0];
            setAudit(data);
            setPages(data.pages as unknown as ClientSeoPageAudit[] || []);
            
            if (history.length > 1) {
                setPastAudits(history.slice(1));
            }

            if (data.status === 'running' || data.status === 'pending') {
                setStatus('running');
            } else {
                setStatus('completed');
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        if (status !== 'running' || !audit?._id) return;

        const eventSource = new EventSource(`/api/seo-audit/${audit._id}/sse`);

        eventSource.onmessage = (event) => {
            try {
                const res = JSON.parse(event.data);
                setProgress({ crawled: res.crawledCount || 0, total: 0 });

                if (res.status === 'completed' || res.status === 'failed') {
                    setStatus(res.status);
                    loadInitialData();
                    if (res.status === 'completed') {
                        toast({ title: 'Audit Finished', description: `Processed ${res.crawledCount || 0} pages.` });
                    } else {
                        toast({ title: 'Audit Failed', description: res.error || 'The audit process failed.', variant: 'destructive' });
                    }
                    eventSource.close();
                }
            } catch (err) {
                console.error('Error parsing SSE event', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE Error', err);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, audit?._id]);

    const handleStartAudit = async () => {
        setStatus('running');
        toast({ title: 'Starting Audit', description: 'Queuing crawler jobs...' });

        try {
            const result = await startAudit(projectId);
            if ('error' in result && result.error) {
                setStatus('failed');
                toast({
                    title: 'Audit failed',
                    description: result.error,
                    variant: 'destructive',
                });
                if (result.auditId) {
                    setAudit(prev => prev ? { ...prev, _id: result.auditId!, status: 'failed' } : null);
                }
                return;
            }
            if ('success' in result && result.success) {
                setStatus('completed');
                toast({
                    title: 'Audit finished',
                    description: result.message || 'Audit completed.',
                });
                await loadInitialData();
                return;
            }
            if (result.auditId) {
                setAudit(prev => prev ? { ...prev, _id: result.auditId!, status: 'running' } : { _id: result.auditId!, projectId, status: 'running', pages: [], totalScore: 0, startedAt: new Date(), summary: { totalPages: 0, criticalIssues: 0, warningIssues: 0 } } as ClientSeoAudit);
                setPages([]);
            }
        } catch (e: unknown) {
            const errMessage = e instanceof Error ? e.message : 'Unknown error occurred';
            toast({ title: 'Error', description: errMessage, variant: 'destructive' });
            setStatus('idle');
        }
    };

    const exportToCSV = () => {
        if (!pages || pages.length === 0) return;
        const headers = ['URL', 'Status', 'Load Time (ms)', 'Word Count', 'Issues'];
        const csvRows = [headers.join(',')];

        pages.forEach((page) => {
            const url = `"${page.url}"`;
            const status = page.status;
            const loadTime = page.loadTime || 0;
            const wordCount = page.wordCount || 0;
            const issues = `"${page.issues?.map((i) => i.message).join('; ') || ''}"`;
            
            csvRows.push([url, status, loadTime, wordCount, issues].join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `audit-${projectId}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        toast({ title: 'Exported CSV', description: 'Your file is downloading.' });
    };

    const exportToPDF = () => {
        window.open(`/dashboard/seo/${projectId}/audit/print`, '_blank');
    };

    const scheduleWeekly = async () => {
        setScheduling(true);
        const res = await updateSeoProjectSettings(projectId, { crawlFrequency: 'weekly' });
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Scheduled', description: 'Audits scheduled weekly.' });
        }
        setScheduling(false);
    };

    if (loading && !audit && status === 'idle') return <Skeleton className="h-[400px] w-full" />;

    return (
        <div className="flex flex-col gap-6 printable-area">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .printable-area, .printable-area * { visibility: visible; }
                    .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                }
            `}</style>
            
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
                        <RefreshCw className={`h-8 w-8 text-[var(--st-text)] ${status === 'running' ? 'animate-spin' : ''}`} />
                        Technical Audit
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-1">Deep crawl analysis using distributed cloud workers.</p>
                </div>
                <div className="flex items-center gap-2 no-print">
                    <Button onClick={scheduleWeekly} disabled={scheduling} variant="outline" className="text-sm">
                        {scheduling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calendar className="h-4 w-4 mr-2" />}
                        Weekly
                    </Button>
                    <Button onClick={handleStartAudit} disabled={status === 'running'}>
                        {status === 'running' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                        {status === 'running' ? 'Crawling...' : 'Start New Audit'}
                    </Button>
                </div>
            </div>

            {status === 'running' && (
                <Card className="bg-[var(--st-text-secondary)]/10 border-[var(--st-text-secondary)]/40 no-print">
                    <CardBody className="p-6 flex items-center gap-4">
                        <Loader2 className="h-8 w-8 text-[var(--st-text-secondary)] animate-spin" />
                        <div className="flex-1">
                            <div className="flex justify-between mb-2">
                                <span className="text-[var(--st-text)]">Audit in Progress</span>
                                <span className="text-[var(--st-text-secondary)]">{progress.crawled} Pages Crawled</span>
                            </div>
                            <Progress value={30} className="h-2" />
                        </div>
                    </CardBody>
                </Card>
            )}

            {!audit ? (
                <Card className="border-dashed py-12 flex flex-col items-center justify-center text-center">
                    <p className="text-[var(--st-text-secondary)] mb-4">No audit history found.</p>
                    <Button onClick={handleStartAudit} className="no-print">Start First Crawl</Button>
                </Card>
            ) : (
                <>
                    <div className="flex justify-end gap-2 no-print flex-wrap">
                        {pastAudits.length > 0 && pastAudits[0].pages && (
                            <AuditDiffViewer currentPages={pages} pastPages={pastAudits[0].pages as unknown as ClientSeoPageAudit[]} />
                        )}
                        <Button variant="outline" size="sm" onClick={exportToCSV}>
                            <Download className="h-4 w-4 mr-2" />
                            CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportToPDF}>
                            <Printer className="h-4 w-4 mr-2" />
                            PDF
                        </Button>
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Overall Health</CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-4xl text-[var(--st-text)]">{audit.totalScore || 0}</span>
                                    <span className="text-[var(--st-text-secondary)]">/ 100</span>
                                </div>
                                <Progress value={audit.totalScore || 0} className="h-2" />
                                {pastAudits.length > 0 && (
                                    <div className="mt-4 text-sm text-[var(--st-text-secondary)] flex items-center gap-1">
                                        <span>Previous: {pastAudits[0].totalScore || 0}</span>
                                        {(audit.totalScore || 0) > (pastAudits[0].totalScore || 0) ? (
                                            <span className="text-[var(--st-status-ok)] flex items-center font-medium"><ArrowRight className="h-3 w-3 inline -rotate-45" /> (+{(audit.totalScore || 0) - (pastAudits[0].totalScore || 0)})</span>
                                        ) : (audit.totalScore || 0) < (pastAudits[0].totalScore || 0) ? (
                                            <span className="text-[var(--st-danger)] flex items-center font-medium"><ArrowRight className="h-3 w-3 inline rotate-45" /> ({(audit.totalScore || 0) - (pastAudits[0].totalScore || 0)})</span>
                                        ) : (
                                            <span className="text-[var(--st-text)] flex items-center">(=)</span>
                                        )}
                                    </div>
                                )}
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Critical Errors</CardTitle>
                            </CardHeader>
                            <CardBody className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-[var(--st-danger)]/10 text-[var(--st-danger)]">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-2xl text-[var(--st-text)]">{audit.summary?.criticalIssues || 0}</div>
                                    <p className="text-xs text-[var(--st-text-secondary)]">Require attention</p>
                                    {pastAudits.length > 0 && (
                                        <p className="text-xs text-[var(--st-text-secondary)] mt-2">Previous: {pastAudits[0].summary?.criticalIssues || 0}</p>
                                    )}
                                </div>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Warnings</CardTitle>
                            </CardHeader>
                            <CardBody className="flex items-center gap-4">
                                <div className="p-3 rounded-full bg-[var(--st-warn)]/10 text-[var(--st-warn)]">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="text-2xl text-[var(--st-text)]">{audit.summary?.warningIssues || 0}</div>
                                    <p className="text-xs text-[var(--st-text-secondary)]">Optimization tips</p>
                                    {pastAudits.length > 0 && (
                                        <p className="text-xs text-[var(--st-text-secondary)] mt-2">Previous: {pastAudits[0].summary?.warningIssues || 0}</p>
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Crawled Pages</CardTitle>
                            <CardDescription>Results from the latest crawl.</CardDescription>
                        </CardHeader>
                        <CardBody>
                            <AuditTable pages={pages} />
                        </CardBody>
                    </Card>
                </>
            )}
        </div>
    );
}
