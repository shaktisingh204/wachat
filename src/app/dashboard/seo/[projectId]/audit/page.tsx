'use client';

import { useEffect, useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Bot, Play, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { startAudit, getLatestAudit } from '@/app/actions/seo.actions';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type Issue = {
    code: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
};

// Mock AI Fix function
import { generateSchemaAction, optimizeMetaAction } from '@/app/actions/seo-ai.actions';

// Real AI Fix function
const generateAiFix = async (issueCode: string, context: any) => {
    let result;

    if (issueCode === 'missing_description' || issueCode === 'missing_title') {
        const keyword = "brand"; // In real usage, pass target keyword from project settings
        const resp = await optimizeMetaAction(context.url || '', keyword, context.title, '');
        if (resp.success) {
            const data = resp.data;
            return `
<!-- Optimized Meta Tags -->
<title>${data.optimizedTitle}</title>
<meta name="description" content="${data.optimizedDesc}" />

<!-- AI Reasoning -->
<!-- ${data.reasoning} -->
             `.trim();
        }
        return "Failed to generate meta tags.";
    }

    if (issueCode === 'missing_h1') {
        // Simple H1 generation, or use the meta optimizer for headlines too
        return `<h1>${context.title || 'Welcome'}</h1>`;
    }

    // Default to Schema Generation for unknown or specific schema issues
    // Example: if issue is 'missing_schema'
    if (issueCode.includes('schema') || true) {
        // Fallback: Try to generate schema for the page
        const resp = await generateSchemaAction(context.url || '', context.title, '');
        if (resp.success) {
            return `
<!-- JSON-LD Schema -->
<script type="application/ld+json">
${JSON.stringify(resp.data.jsonLd, null, 2)}
</script>

<!-- Type: ${resp.data.schemaType} -->
            `.trim();
        }
    }

    return "AI suggestion not available for this issue type.";
};

export default function AuditPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const [audit, setAudit] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [runningAudit, setRunningAudit] = useState(false);

    // AI Fix State
    const [fixingIssue, setFixingIssue] = useState<string | null>(null);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

    const loadAudit = async () => {
        setLoading(true);
        const data = await getLatestAudit(projectId);
        setAudit(data);
        setLoading(false);
    };

    useEffect(() => {
        loadAudit();
    }, [projectId]);

    const handleStartAudit = async () => {
        setRunningAudit(true);
        toast({ title: "Audit Started", description: "Crawler is running in background..." });
        await startAudit(projectId);

        // Poll for completion - Simplified for MVP
        setTimeout(() => {
            loadAudit();
            setRunningAudit(false);
            toast({ title: "Audit Completed", description: "Fresh data loaded." });
        }, 5000);
    };

    const handleAiFix = async (issue: Issue, pageData: any) => {
        setFixingIssue(issue.code);
        setAiSuggestion(null);

        try {
            const suggestion = await generateAiFix(issue.code, { title: pageData.title });
            setAiSuggestion(suggestion);
        } finally {
            setFixingIssue(null);
        }
    };

    if (loading && !audit) return <Skeleton className="h-[400px] w-full" />;

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <RefreshCw className="h-8 w-8 text-primary" />
                        Technical Audit
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Identify and fix technical SEO issues with Active AI.
                    </p>
                </div>
                <Button onClick={handleStartAudit} disabled={runningAudit}>
                    {runningAudit ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    {runningAudit ? 'Crawling...' : 'Run New Audit'}
                </Button>
            </div>

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
                                <Progress value={audit.totalScore || 0} className={`h-2 ${(audit.totalScore || 0) > 80 ? 'bg-green-100 [&>div]:bg-green-500' : 'bg-red-100 [&>div]:bg-red-500'
                                    }`} />
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
                                    <p className="text-xs text-muted-foreground">Require immediate attention</p>
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
                                    <p className="text-xs text-muted-foreground">Optimization opportunities</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Issues List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Identified Issues</CardTitle>
                            <CardDescription>Issues found on {audit.pages?.length || 0} crawled pages.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {audit.pages?.map((page: any, i: number) => (
                                <Collapsible key={i} className="border rounded-md p-4">
                                    <CollapsibleTrigger className="flex items-center justify-between w-full hover:bg-muted/50 p-2 rounded transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <GlobeStatus status={page.status} />
                                            <span className="font-medium truncate max-w-[300px]">{page.url}</span>
                                            <Badge variant="outline">{page.issues.length} Issues</Badge>
                                        </div>
                                        <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                                    </CollapsibleTrigger>

                                    <CollapsibleContent className="mt-4 space-y-3 pl-11">
                                        {page.issues.length === 0 ? (
                                            <div className="text-sm text-green-600 flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4" /> No issues found.
                                            </div>
                                        ) : (
                                            page.issues.map((issue: Issue, j: number) => (
                                                <div key={j} className="flex items-start justify-between bg-muted/30 p-3 rounded text-sm">
                                                    <div className="flex gap-2">
                                                        <IssueIcon severity={issue.severity} />
                                                        <div>
                                                            <p className="font-medium">{issue.message}</p>
                                                            <p className="text-xs text-muted-foreground uppercase mt-1">{issue.code}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                                                            onClick={() => handleAiFix(issue, page)}
                                                        >
                                                            <Bot className="h-3 w-3" /> Fix with AI
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}

                                        {/* AI Suggestion Display Area (Global per page for demo simplicity) */}
                                        {aiSuggestion && (
                                            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center gap-2 mb-2 text-blue-700 font-semibold">
                                                    <Bot className="h-4 w-4" /> AI Suggestion
                                                </div>
                                                <pre className="bg-white p-3 rounded border text-xs overflow-x-auto text-slate-700 font-mono">
                                                    {aiSuggestion}
                                                </pre>
                                                <div className="flex gap-2 mt-3">
                                                    <Button size="sm">Apply to CMS</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setAiSuggestion(null)}>Dismiss</Button>
                                                </div>
                                            </div>
                                        )}
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}

function GlobeStatus({ status }: { status: number }) {
    if (status >= 200 && status < 300) return <div className="h-3 w-3 rounded-full bg-green-500" title="200 OK" />;
    if (status >= 300 && status < 400) return <div className="h-3 w-3 rounded-full bg-blue-500" title="Redirect" />;
    return <div className="h-3 w-3 rounded-full bg-red-500" title="Error" />;
}

function IssueIcon({ severity }: { severity: string }) {
    if (severity === 'critical') return <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />;
    if (severity === 'warning') return <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />;
    return <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />;
}
