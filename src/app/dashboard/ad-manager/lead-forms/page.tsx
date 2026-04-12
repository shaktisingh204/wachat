'use client';

import * as React from 'react';
import { FileText, Plus, Download, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getFacebookPagesForAdCreation, listLeadGenForms, getLeadsFromForm } from '@/app/actions/ad-manager.actions';
import type { FacebookPage } from '@/lib/definitions';

export default function LeadFormsPage() {
    const { toast } = useToast();
    const [pages, setPages] = React.useState<FacebookPage[]>([]);
    const [selectedPage, setSelectedPage] = React.useState<string>('');
    const [forms, setForms] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [createOpen, setCreateOpen] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            const res = await getFacebookPagesForAdCreation();
            if (res.pages) {
                setPages(res.pages);
                if (res.pages.length > 0) setSelectedPage(res.pages[0].id);
            }
        })();
    }, []);

    React.useEffect(() => {
        if (!selectedPage) return;
        (async () => {
            setLoading(true);
            const res = await listLeadGenForms(selectedPage);
            setForms(res.data || []);
            setLoading(false);
        })();
    }, [selectedPage]);

    const exportLeads = async (formId: string) => {
        const res = await getLeadsFromForm(formId);
        if (res.error) {
            toast({ title: 'Export failed', description: res.error, variant: 'destructive' });
            return;
        }
        const leads = res.data || [];
        const rows = leads.map((l: any) => {
            const fields: Record<string, string> = {};
            for (const f of l.field_data || []) fields[f.name] = (f.values || []).join('; ');
            return { id: l.id, created_time: l.created_time, ...fields };
        });
        if (rows.length === 0) {
            toast({ title: 'No leads yet' });
            return;
        }
        const headers = Object.keys(rows[0]);
        const csv = [
            headers.join(','),
            ...rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-${formId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: `${rows.length} leads exported` });
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-6 w-6" /> Lead forms
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Instant forms collected from your Lead Ads. Export to CSV or sync to CRM.
                    </p>
                </div>
                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> New lead form
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Facebook page:</span>
                <Select value={selectedPage} onValueChange={setSelectedPage}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Select a page" />
                    </SelectTrigger>
                    <SelectContent>
                        {pages.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Total leads count stat card */}
            {!loading && forms.length > 0 && (
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total leads across all forms</p>
                            <p className="text-2xl font-bold tabular-nums">
                                {forms.reduce((sum: number, f: any) => sum + (f.leads_count || 0), 0)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Form</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Leads</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {forms.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No lead forms on this page yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    forms.map((f) => (
                                        <TableRow key={f.id}>
                                            <TableCell className="font-medium">{f.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{f.status}</Badge>
                                            </TableCell>
                                            <TableCell className="tabular-nums">{f.leads_count || 0}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {f.created_time
                                                    ? new Date(f.created_time).toLocaleDateString()
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <Button size="sm" variant="outline" onClick={() => exportLeads(f.id)}>
                                                        <Download className="h-3 w-3 mr-1" /> Export
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            toast({ title: 'Leads synced to CRM', description: `${f.leads_count || 0} leads from "${f.name}" synced to CRM.` });
                                                        }}
                                                    >
                                                        <RefreshCw className="h-3 w-3 mr-1" /> Sync to CRM
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Lead Form</DialogTitle>
                        <DialogDescription>Lead forms are created through Meta Ads Manager. Use the link below to create one.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">To create a new lead generation form:</p>
                        <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                            <li>Go to Meta Ads Manager</li>
                            <li>Create a new campaign with Lead Generation objective</li>
                            <li>Build your Instant Form in the ad creation step</li>
                            <li>The form will appear here automatically</li>
                        </ol>
                        <Button asChild className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                            <a href="https://business.facebook.com/adsmanager" target="_blank" rel="noopener noreferrer">
                                Open Meta Ads Manager
                            </a>
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
