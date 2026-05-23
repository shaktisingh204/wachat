'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
  Card,
  ZoruCardContent,
  Checkbox,
  Input,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Table2,
  Upload,
  Download,
  Save,
  AlertCircle,
  Settings,
  RotateCcw } from 'lucide-react';

import * as React from 'react';
import Papa from 'papaparse';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { listCampaigns, listAdSets, updateCampaign, updateAdSet, updateAd } from '@/app/actions/ad-manager.actions';
import { getAdPreviews } from '@/app/actions/ad-manager-features.actions';

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
    const [originalRows, setOriginalRows] = React.useState<EditableRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const csvRef = React.useRef<HTMLInputElement>(null);

    const [entityType, setEntityType] = React.useState<'campaigns' | 'adsets' | 'ads'>('campaigns');

    const loadData = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        let resData: any[] = [];
        if (entityType === 'campaigns') {
            const res = await listCampaigns(activeAccount.account_id);
            resData = res.data || [];
        } else if (entityType === 'adsets') {
            const res = await listAdSets(activeAccount.account_id, 'account');
            resData = res.data || [];
        } else if (entityType === 'ads') {
            const res = await getAdPreviews(activeAccount.account_id);
            resData = res.ads || [];
        }
        
        const mapped = resData.map((c: any) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : 0,
        }));
        setRows(mapped);
        setOriginalRows(mapped.map((r) => ({ ...r })));
        setSelectedIds(new Set());
        setLoading(false);
    }, [activeAccount, entityType]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const allSelected = rows.length > 0 && selectedIds.size === rows.length;
    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(rows.map((r) => r.id)));
        }
    };
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

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
            let res;
            if (entityType === 'campaigns') {
                res = await updateCampaign(r.id, { name: r.name, daily_budget: Math.round(r.daily_budget * 100) });
            } else if (entityType === 'adsets') {
                res = await updateAdSet(r.id, { name: r.name, daily_budget: Math.round(r.daily_budget * 100) });
            } else {
                res = await updateAd(r.id, { name: r.name });
            }
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
        const csv = Papa.unparse(rows.map(r => ({
            id: r.id,
            name: r.name,
            status: r.status,
            daily_budget: r.daily_budget
        })));
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
            <div className="space-y-6">
                <AmBreadcrumb page="Bulk Editor" />
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to bulk edit.</ZoruAlertDescription>
                </Alert>
            </div>
        );
    }

    const dirtyCount = rows.filter((r) => r.dirty).length;

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Bulk Editor" />
            <AmHeader
                title="Bulk editor"
                description={`Spreadsheet-style editing. Change names and budgets for multiple ${entityType} at once.`}
                actions={
                    <div className="flex flex-wrap gap-2 items-center">
                        <select 
                            value={entityType} 
                            onChange={(e) => setEntityType(e.target.value as any)}
                            className="h-9 px-3 rounded-md border border-input bg-background text-sm mr-2"
                        >
                            <option value="campaigns">Campaigns</option>
                            <option value="adsets">Ad Sets</option>
                            <option value="ads">Ads</option>
                        </select>
                        <Button variant="outline" onClick={exportCsv}>
                            <Download className="h-4 w-4 mr-1" /> Export CSV
                        </Button>
                        <input
                            ref={csvRef}
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                Papa.parse(file, {
                                    header: true,
                                    skipEmptyLines: true,
                                    complete: (results) => {
                                        const imported: EditableRow[] = [];
                                        for (const row of results.data as any[]) {
                                            if (row.id) {
                                                imported.push({
                                                    id: row.id,
                                                    name: row.name || '',
                                                    status: row.status || 'PAUSED',
                                                    daily_budget: Number(row.daily_budget) || 0,
                                                    dirty: true,
                                                });
                                            }
                                        }
                                        if (imported.length > 0) {
                                            setRows(imported);
                                            toast({ title: `Imported ${imported.length} items from CSV` });
                                        } else {
                                            toast({ title: 'No valid items found in CSV' });
                                        }
                                    },
                                    error: (error: Error) => {
                                        toast({ title: 'Error parsing CSV', description: error.message, variant: 'destructive' });
                                    }
                                });
                                e.target.value = '';
                            }}
                        />
                        <Button variant="outline" onClick={() => csvRef.current?.click()}>
                            <Upload className="h-4 w-4 mr-1" /> Import CSV
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRows(originalRows.map((r) => ({ ...r })));
                                setSelectedIds(new Set());
                                toast({ title: 'Changes reset', description: 'All edits have been reverted to original data.' });
                            }}
                            disabled={saving || dirtyCount === 0}
                        >
                            <RotateCcw className="h-4 w-4 mr-1" /> Reset Changes
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
                }
            />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Table2 className="h-4 w-4" />
                <span>Edit campaigns inline; dirty rows are highlighted until saved.</span>
            </div>

            <Card>
                <ZoruCardContent className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : (
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead className="w-10">
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Select all"
                                        />
                                    </ZoruTableHead>
                                    <ZoruTableHead>ID</ZoruTableHead>
                                    <ZoruTableHead>Name</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    {entityType !== 'ads' && <ZoruTableHead>Daily budget</ZoruTableHead>}
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {rows.map((r) => (
                                    <ZoruTableRow key={r.id} className={r.dirty ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                                        <ZoruTableCell className="w-10">
                                            <Checkbox
                                                checked={selectedIds.has(r.id)}
                                                onCheckedChange={() => toggleSelect(r.id)}
                                                aria-label={`Select ${r.name}`}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-xs font-mono text-muted-foreground">{r.id}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <Input
                                                value={r.name}
                                                onChange={(e) => updateRow(r.id, { name: e.target.value })}
                                                className="h-8"
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>{r.status}</ZoruTableCell>
                                        {entityType !== 'ads' && (
                                            <ZoruTableCell>
                                                <Input
                                                    type="number"
                                                    value={r.daily_budget}
                                                    onChange={(e) => updateRow(r.id, { daily_budget: Number(e.target.value) })}
                                                    className="h-8 w-28"
                                                />
                                            </ZoruTableCell>
                                        )}
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
