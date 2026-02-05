'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, ExternalLink, Bot } from "lucide-react";
import { SeoPageAudit, SeoPageIssue } from "@/lib/seo/definitions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { Label } from "@/components/ui/label";

function IssueBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
    if (severity === 'critical') return <Badge variant="destructive" className="h-5 text-[10px]">Critical</Badge>;
    if (severity === 'warning') return <Badge variant="secondary" className="h-5 text-[10px] bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Warning</Badge>;
    return <Badge variant="outline" className="h-5 text-[10px]">Info</Badge>;
}

export function AuditTable({ pages }: { pages: any[] }) {
    // Pages is AuditSnapshot[] actually.

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[400px]">URL</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Load Time (ms)</TableHead>
                        <TableHead>Words</TableHead>
                        <TableHead className="text-right">Issues</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pages.map((page, idx) => (
                        <AuditRow key={idx} page={page} />
                    ))}
                    {pages.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                No pages crawled yet.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}


// ... (Previous imports kept, adding Dialog)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { generateMetaTagsAction } from "@/app/actions/seo-ai.actions";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function AuditRow({ page }: { page: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [aiResult, setAiResult] = useState<any>(null);
    const { toast } = useToast();

    const critical = page.issues.filter((i: any) => i.severity === 'critical').length;
    const warning = page.issues.filter((i: any) => i.severity === 'warning').length;

    const handleFix = async (issueCode: string) => {
        // Only handling meta tags for now
        if (issueCode !== 'missing_meta_desc' && issueCode !== 'missing_title' && !issueCode.includes('length')) {
            toast({ title: "AI Fix not available for this issue yet.", variant: "destructive" });
            return;
        }

        setAiOpen(true);
        setGenerating(true);

        // Guess keyword from H1 or URL if not present. In real app, we'd pass project targeted keyword.
        const keyword = page.h1 || "relevant topic";

        const res = await generateMetaTagsAction(page.url, page.title, page.metaDescription, keyword);

        if (res.success) {
            setAiResult(res.data);
        } else {
            toast({ title: "Generation Failed", description: res.error, variant: "destructive" });
            setAiOpen(false);
        }
        setGenerating(false);
    };

    return (
        <>
            <TableRow className="group">
                <TableCell className="font-medium max-w-[400px] truncate">
                    <a href={page.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                        {page.url}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                    </a>
                    {page.title && <div className="text-xs text-muted-foreground truncate">{page.title}</div>}
                </TableCell>
                <TableCell>
                    <Badge variant={page.status >= 400 ? "destructive" : "outline"} className={page.status >= 200 && page.status < 300 ? "border-green-500 text-green-600" : ""}>
                        {page.status}
                    </Badge>
                </TableCell>
                <TableCell className={page.loadTime > 2000 ? "text-red-500 font-medium" : ""}>
                    {page.loadTime}ms
                </TableCell>
                <TableCell>{page.wordCount}</TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                        {critical > 0 && <Badge variant="destructive">{critical} Major</Badge>}
                        {warning > 0 && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{warning} Warn</Badge>}
                        {critical === 0 && warning === 0 && <CheckCircle className="h-5 w-5 text-green-500" />}
                    </div>
                </TableCell>
                <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)}>
                        {isOpen ? "Hide" : "View"}
                    </Button>
                </TableCell>
            </TableRow>
            {isOpen && (
                <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="p-4">
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Identified Issues</h4>
                            {page.issues.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No issues found on this page.</p>
                            ) : (
                                <ul className="grid gap-2">
                                    {page.issues.map((issue: any, i: number) => (
                                        <li key={i} className="text-sm flex items-center justify-between border p-2 rounded bg-background">
                                            <div className="flex items-center gap-2">
                                                <IssueBadge severity={issue.severity} />
                                                <span>{issue.message}</span>
                                            </div>
                                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleFix(issue.code)}>
                                                <Bot className="h-3 w-3" /> Fix with AI
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* ... (H1/Meta Box kept same) ... */}
                            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                                <div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">H1 Tag</span>
                                    <p className="text-sm border p-2 rounded mt-1 bg-background">{page.h1 || "Missing"}</p>
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Meta Description</span>
                                    <p className="text-sm border p-2 rounded mt-1 bg-background">{page.metaDescription || "Missing"}</p>
                                </div>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}

            <Dialog open={aiOpen} onOpenChange={setAiOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>AI Code Fixer</DialogTitle>
                        <DialogDescription>Generates optimized meta tags based on page content and best practices.</DialogDescription>
                    </DialogHeader>

                    {generating ? (
                        <div className="py-12 flex flex-col items-center justify-center">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                            <p>Analyzing content and generating tags...</p>
                        </div>
                    ) : aiResult ? (
                        <div className="space-y-4">
                            <div className="bg-muted p-4 rounded-md">
                                <h4 className="font-semibold text-sm mb-2">Reasoning</h4>
                                <p className="text-sm text-muted-foreground">{aiResult.reasoning}</p>
                            </div>

                            <div className="grid gap-4">
                                <div>
                                    <Label className="text-xs uppercase text-muted-foreground">Optimized Title ({aiResult.optimizedTitle.length} chars)</Label>
                                    <div className="flex gap-2 mt-1">
                                        <div className="border p-2 rounded flex-1 bg-background text-sm">{aiResult.optimizedTitle}</div>
                                        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(aiResult.optimizedTitle); toast({ title: "Copied!" }); }}>Copy</Button>
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-xs uppercase text-muted-foreground">Optimized Description ({aiResult.optimizedDesc.length} chars)</Label>
                                    <div className="flex gap-2 mt-1">
                                        <div className="border p-2 rounded flex-1 bg-background text-sm">{aiResult.optimizedDesc}</div>
                                        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(aiResult.optimizedDesc); toast({ title: "Copied!" }); }}>Copy</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}

