'use client';

import * as React from 'react';
import { Table2, Upload, Download, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { listCampaigns, batchUpdateStatus, updateCampaign } from '@/app/actions/ad-manager.actions';

type EditableRow = {
    id: string;
    name: string;
    status: string;
    daily_budget: number;
    dirty?: boolean;
};

export default function BulkEditorPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [rows, setRows] = React.useState<EditableRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (!activeAccount) return;
        (async () => {
            setLoading(true);
            const res = await listCampaigns(activeAccount.account_id);
            const mapped = (res.data || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : 0,
            }));
            setRows(mapped);
            setLoading(false);
        })();
    }, [activeAccount]);

    const updateRow = (id: string, patch: Partial<EditableRow>) => {
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, dirty: true } : r)));
    };

    const saveAll = async () => {
        const dirty = rows.filter((r) => r.dirty);
        if (dirty.length === 0) {
            toast({ title: 'Nothing to save' });
            return;
        }
        setSaving(true);
        let success = 0;
        let fail = 0;
        for (const r of dirty) {
            const res = await updateCampaign(r.id, {
                name: r.name,
                daily_budget: Math.round(r.daily_budget * 100),
            });
            if (res.error) fail++;
            else success++;
        }
        setSaving(false);
        setRows((rs) => rs.map((r) => ({ ...r, dirty: false })));
        toast({
            title: `Saved ${success}/${dirty.length}`,
            description: fail ? `${fail} failed` : undefined,
            variant: fail ? 'destructive' : 'default',
        });
    };

    const exportCsv = () => {
        const headers = ['id', 'name', 'status', 'daily_budget'];
        const csv = [
            headers.join(','),
            ...rows.map((r) => headers.map((h) => String((r as any)[h]).replace(/"/g, '""')).join(',')),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'campaigns.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!activeAccount) {
        return (
            <div className="p-8">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to bulk edit.</AlertDescription>
                </Alert>
            </div>
        );
    }

    const dirtyCount = rows.filter((r) => r.dirty).length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Table2 className="h-6 w-6" /> Bulk editor
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Spreadsheet-style editing. Change names and budgets for multiple campaigns at once.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportCsv}>
                        <Download className="h-4 w-4 mr-1" /> Export CSV
                    </Button>
                    <Button variant="outline">
                        <Upload className="h-4 w-4 mr-1" /> Import CSV
                    </Button>
                    <Button
                        className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                        onClick={saveAll}
                        disabled={saving || dirtyCount === 0}
                    >
                        <Save className="h-4 w-4 mr-1" />
                        {saving ? 'Saving…' : `Save ${dirtyCount || ''} changes`}
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Daily budget</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((r) => (
                                    <TableRow key={r.id} className={r.dirty ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                                        <TableCell className="text-xs font-mono text-muted-foreground">{r.id}</TableCell>
                                        <TableCell>
                                            <Input
                                                value={r.name}
                                                onChange={(e) => updateRow(r.id, { name: e.target.value })}
                                                className="h-8"
                                            />
                                        </TableCell>
                                        <TableCell>{r.status}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={r.daily_budget}
                                                onChange={(e) => updateRow(r.id, { daily_budget: Number(e.target.value) })}
                                                className="h-8 w-28"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
