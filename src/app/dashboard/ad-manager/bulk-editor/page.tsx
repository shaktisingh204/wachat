'use client';

import { Alert, AlertDescription, AlertTitle, Button, Card, CardBody, Checkbox, Input, Skeleton, Table, TBody, Td, Th, THead, Tr, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, Label } from '@/components/sabcrm/20ui/compat';
import {
  Table2,
  Upload,
  Download,
  Save,
  AlertCircle,
  RotateCcw,
  Undo2,
  Redo2,
  Search,
  Percent
} from 'lucide-react';

import * as React from 'react';
import Papa from 'papaparse';
import { useVirtualizer } from '@tanstack/react-virtual';

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

const EditableNameCell = React.memo(({ row, onUpdate }: { row: EditableRow, onUpdate: (id: string, patch: Partial<EditableRow>) => void }) => {
    const [val, setVal] = React.useState(row.name);
    React.useEffect(() => { setVal(row.name); }, [row.name]);

    return (
        <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => {
                if (val !== row.name) onUpdate(row.id, { name: val });
            }}
            className="h-8"
        />
    );
});
EditableNameCell.displayName = 'EditableNameCell';

const EditableBudgetCell = React.memo(({ row, onUpdate }: { row: EditableRow, onUpdate: (id: string, patch: Partial<EditableRow>) => void }) => {
    const [val, setVal] = React.useState(row.daily_budget.toString());
    React.useEffect(() => { setVal(row.daily_budget.toString()); }, [row.daily_budget]);

    return (
        <Input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => {
                const num = Number(val);
                if (!isNaN(num) && num !== row.daily_budget) {
                    onUpdate(row.id, { daily_budget: num });
                } else {
                    setVal(row.daily_budget.toString());
                }
            }}
            className="h-8 w-28"
        />
    );
});
EditableBudgetCell.displayName = 'EditableBudgetCell';

export default function BulkEditorPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [rows, setRows] = React.useState<EditableRow[]>([]);
    
    // History queue for Undo/Redo
    const [history, setHistory] = React.useState<EditableRow[][]>([]);
    const [historyIndex, setHistoryIndex] = React.useState(-1);

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const csvRef = React.useRef<HTMLInputElement>(null);

    const [entityType, setEntityType] = React.useState<'campaigns' | 'adsets' | 'ads'>('campaigns');

    const [findText, setFindText] = React.useState('');
    const [replaceText, setReplaceText] = React.useState('');
    const [findReplaceOpen, setFindReplaceOpen] = React.useState(false);

    const [budgetIncrement, setBudgetIncrement] = React.useState('');
    const [budgetIncrementOpen, setBudgetIncrementOpen] = React.useState(false);

    const parentRef = React.useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 48,
        overscan: 10,
    });

    const rowsRef = React.useRef(rows);
    const historyRef = React.useRef(history);
    const historyIndexRef = React.useRef(historyIndex);
    
    React.useEffect(() => { rowsRef.current = rows; }, [rows]);
    React.useEffect(() => { historyRef.current = history; }, [history]);
    React.useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

    const pushHistory = React.useCallback((newRows: EditableRow[]) => {
        const h = historyRef.current;
        const i = historyIndexRef.current;
        const nextHistory = h.slice(0, i + 1);
        nextHistory.push(newRows);
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
        setRows(newRows);
    }, []);

    const undo = React.useCallback(() => {
        const i = historyIndexRef.current;
        const h = historyRef.current;
        if (i > 0) {
            const nextIndex = i - 1;
            setHistoryIndex(nextIndex);
            setRows(h[nextIndex]);
        }
    }, []);

    const redo = React.useCallback(() => {
        const i = historyIndexRef.current;
        const h = historyRef.current;
        if (i < h.length - 1) {
            const nextIndex = i + 1;
            setHistoryIndex(nextIndex);
            setRows(h[nextIndex]);
        }
    }, []);

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
        setHistory([mapped]);
        setHistoryIndex(0);
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
    
    const toggleSelect = React.useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleUpdateRow = React.useCallback((id: string, patch: Partial<EditableRow>) => {
        const newRows = rowsRef.current.map((r) => (r.id === id ? { ...r, ...patch, dirty: true } : r));
        pushHistory(newRows);
    }, [pushHistory]);

    const applyFindReplace = () => {
        if (!findText) return;
        
        const targetIds = selectedIds.size > 0 ? selectedIds : new Set(rows.map(r => r.id));
        let changed = false;
        
        const newRows = rows.map(r => {
            if (targetIds.has(r.id) && r.name.includes(findText)) {
                changed = true;
                const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return { ...r, name: r.name.replace(new RegExp(escaped, 'g'), replaceText), dirty: true };
            }
            return r;
        });
        
        if (changed) {
            pushHistory(newRows);
            toast({ title: `Replaced text in multiple items` });
        } else {
            toast({ title: `No matches found` });
        }
        setFindReplaceOpen(false);
    };

    const applyBudgetIncrement = () => {
        const percent = parseFloat(budgetIncrement);
        if (isNaN(percent)) return;
        
        const targetIds = selectedIds.size > 0 ? selectedIds : new Set(rows.map(r => r.id));
        let changed = false;
        
        const newRows = rows.map(r => {
            if (targetIds.has(r.id)) {
                changed = true;
                const newBudget = Number((r.daily_budget * (1 + percent / 100)).toFixed(2));
                return { ...r, daily_budget: newBudget, dirty: true };
            }
            return r;
        });
        
        if (changed) {
            pushHistory(newRows);
            toast({ title: `Updated budgets by ${percent}%` });
        }
        setBudgetIncrementOpen(false);
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
            if (res?.error) fail++;
            else success++;
        }
        setSaving(false);
        const newRows = rows.map((r) => ({ ...r, dirty: false }));
        setRows(newRows);
        setHistory([newRows]);
        setHistoryIndex(0);
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
        a.download = `${entityType}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Bulk Editor" />
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to bulk edit.</AlertDescription>
                </Alert>
            </div>
        );
    }

    const dirtyCount = rows.filter((r) => r.dirty).length;
    const virtualItems = rowVirtualizer.getVirtualItems();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0 ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;

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
                            className="h-9 px-3 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-sm mr-2"
                        >
                            <option value="campaigns">Campaigns</option>
                            <option value="adsets">Ad Sets</option>
                            <option value="ads">Ads</option>
                        </select>
                        
                        <div className="flex items-center rounded-md border border-[var(--st-border)] overflow-hidden">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none border-r" onClick={undo} disabled={historyIndex <= 0} title="Undo">
                                <Undo2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo">
                                <Redo2 className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <Button variant="outline" onClick={exportCsv}>
                            <Download className="h-4 w-4 mr-1" /> Export
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
                                            pushHistory(imported);
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
                            <Upload className="h-4 w-4 mr-1" /> Import
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRows(history[0]);
                                setHistory([history[0]]);
                                setHistoryIndex(0);
                                setSelectedIds(new Set());
                                toast({ title: 'Changes reset', description: 'All edits have been reverted to original data.' });
                            }}
                            disabled={saving || dirtyCount === 0}
                        >
                            <RotateCcw className="h-4 w-4 mr-1" /> Reset
                        </Button>
                        <Button
                            className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white"
                            onClick={saveAll}
                            disabled={saving || dirtyCount === 0}
                        >
                            <Save className="h-4 w-4 mr-1" />
                            {saving ? 'Saving…' : `Save ${dirtyCount || ''}`}
                        </Button>
                    </div>
                }
            />

            <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)] flex-wrap">
                <Table2 className="h-4 w-4" />
                <span>Edit {entityType} inline. Use bulk tools below for selected items.</span>

                <div className="ml-auto flex items-center gap-2">
                    <Dialog open={findReplaceOpen} onOpenChange={setFindReplaceOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary" size="sm">
                                <Search className="h-4 w-4 mr-1" /> Find & Replace
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Find & Replace Names</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Find</Label>
                                    <Input value={findText} onChange={e => setFindText(e.target.value)} placeholder="Text to search for..." />
                                </div>
                                <div className="space-y-2">
                                    <Label>Replace with</Label>
                                    <Input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="Replacement text..." />
                                </div>
                                <p className="text-xs text-[var(--st-text-secondary)]">Applies to selected items, or all if none selected.</p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setFindReplaceOpen(false)}>Cancel</Button>
                                <Button onClick={applyFindReplace}>Apply</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {entityType !== 'ads' && (
                        <Dialog open={budgetIncrementOpen} onOpenChange={setBudgetIncrementOpen}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" size="sm">
                                    <Percent className="h-4 w-4 mr-1" /> Bulk Edit Budgets
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Increase/Decrease Budgets</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Percentage (%)</Label>
                                        <Input 
                                            type="number" 
                                            value={budgetIncrement} 
                                            onChange={e => setBudgetIncrement(e.target.value)} 
                                            placeholder="e.g. 10 for +10%, -20 for -20%" 
                                        />
                                    </div>
                                    <p className="text-xs text-[var(--st-text-secondary)]">Applies to selected items, or all if none selected.</p>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setBudgetIncrementOpen(false)}>Cancel</Button>
                                    <Button onClick={applyBudgetIncrement}>Apply</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            <Card>
                <CardBody className="p-0">
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    ) : (
                        <div ref={parentRef} className="h-[600px] overflow-auto">
                            <Table>
                                <THead className="sticky top-0 z-10 bg-[var(--st-bg-secondary)]/95 backdrop-blur shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                                    <Tr>
                                        <Th className="w-10">
                                            <Checkbox
                                                checked={allSelected}
                                                onCheckedChange={toggleSelectAll}
                                                aria-label="Select all"
                                            />
                                        </Th>
                                        <Th className="w-40">ID</Th>
                                        <Th>Name</Th>
                                        <Th className="w-24">Status</Th>
                                        {entityType !== 'ads' && <Th className="w-40">Daily budget</Th>}
                                    </Tr>
                                </THead>
                                <TBody>
                                    {paddingTop > 0 && <tr><td style={{ height: paddingTop }} /></tr>}
                                    {virtualItems.map((virtualRow) => {
                                        const r = rows[virtualRow.index];
                                        return (
                                            <Tr 
                                                key={r.id} 
                                                className={r.dirty ? 'bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/20' : ''}
                                                data-index={virtualRow.index}
                                                ref={rowVirtualizer.measureElement}
                                            >
                                                <Td className="w-10">
                                                    <Checkbox
                                                        checked={selectedIds.has(r.id)}
                                                        onCheckedChange={() => toggleSelect(r.id)}
                                                        aria-label={`Select ${r.name}`}
                                                    />
                                                </Td>
                                                <Td className="text-xs font-mono text-[var(--st-text-secondary)] w-40 truncate">{r.id}</Td>
                                                <Td>
                                                    <EditableNameCell row={r} onUpdate={handleUpdateRow} />
                                                </Td>
                                                <Td className="w-24">
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${r.status === 'ACTIVE' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'}`}>
                                                        {r.status}
                                                    </span>
                                                </Td>
                                                {entityType !== 'ads' && (
                                                    <Td className="w-40">
                                                        <EditableBudgetCell row={r} onUpdate={handleUpdateRow} />
                                                    </Td>
                                                )}
                                            </Tr>
                                        );
                                    })}
                                    {paddingBottom > 0 && <tr><td style={{ height: paddingBottom }} /></tr>}
                                </TBody>
                            </Table>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
