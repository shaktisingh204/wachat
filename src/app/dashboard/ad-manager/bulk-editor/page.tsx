'use client';

import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    Checkbox,
    Field,
    IconButton,
    Input,
    Modal,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import {
    Table2,
    Upload,
    Download,
    Save,
    RotateCcw,
    Undo2,
    Redo2,
    Search,
    Percent,
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
            inputSize="sm"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => {
                if (val !== row.name) onUpdate(row.id, { name: val });
            }}
            aria-label={`Name for ${row.name}`}
        />
    );
});
EditableNameCell.displayName = 'EditableNameCell';

const EditableBudgetCell = React.memo(({ row, onUpdate }: { row: EditableRow, onUpdate: (id: string, patch: Partial<EditableRow>) => void }) => {
    const [val, setVal] = React.useState(row.daily_budget.toString());
    React.useEffect(() => { setVal(row.daily_budget.toString()); }, [row.daily_budget]);

    return (
        <Input
            inputSize="sm"
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
            className="w-28"
            aria-label={`Daily budget for ${row.name}`}
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
            toast({ title: 'Replaced text in multiple items' });
        } else {
            toast({ title: 'No matches found' });
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

    const importCsvFile = (file: File) => {
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
            },
        });
    };

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Bulk Editor" />
                <Alert tone="warning" title="No ad account selected">
                    Pick an ad account to bulk edit.
                </Alert>
            </div>
        );
    }

    const dirtyCount = rows.filter((r) => r.dirty).length;
    const columnCount = entityType !== 'ads' ? 5 : 4;
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
                        <Select value={entityType} onValueChange={(v) => setEntityType(v as 'campaigns' | 'adsets' | 'ads')}>
                            <SelectTrigger aria-label="Entity type" className="w-36 mr-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="campaigns">Campaigns</SelectItem>
                                <SelectItem value="adsets">Ad Sets</SelectItem>
                                <SelectItem value="ads">Ads</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1">
                            <IconButton label="Undo" icon={Undo2} variant="outline" onClick={undo} disabled={historyIndex <= 0} />
                            <IconButton label="Redo" icon={Redo2} variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1} />
                        </div>

                        <Button variant="outline" iconLeft={Download} onClick={exportCsv}>
                            Export
                        </Button>
                        <SabFileToFileButton
                            accept="document"
                            variant="outline"
                            onPickFile={importCsvFile}
                            onError={(error) => toast({ title: 'Error reading file', description: error.message, variant: 'destructive' })}
                        >
                            <Upload size={14} aria-hidden="true" />
                            <span>Import</span>
                        </SabFileToFileButton>
                        <Button
                            variant="outline"
                            iconLeft={RotateCcw}
                            onClick={() => {
                                setRows(history[0]);
                                setHistory([history[0]]);
                                setHistoryIndex(0);
                                setSelectedIds(new Set());
                                toast({ title: 'Changes reset', description: 'All edits have been reverted to original data.' });
                            }}
                            disabled={saving || dirtyCount === 0}
                        >
                            Reset
                        </Button>
                        <Button
                            variant="primary"
                            iconLeft={Save}
                            onClick={saveAll}
                            loading={saving}
                            disabled={saving || dirtyCount === 0}
                        >
                            {saving ? 'Saving' : `Save ${dirtyCount || ''}`}
                        </Button>
                    </div>
                }
            />

            <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)] flex-wrap">
                <Table2 className="h-4 w-4" aria-hidden="true" />
                <span>Edit {entityType} inline. Use bulk tools below for selected items.</span>

                <div className="ml-auto flex items-center gap-2">
                    <Button variant="secondary" size="sm" iconLeft={Search} onClick={() => setFindReplaceOpen(true)}>
                        Find &amp; Replace
                    </Button>

                    {entityType !== 'ads' && (
                        <Button variant="secondary" size="sm" iconLeft={Percent} onClick={() => setBudgetIncrementOpen(true)}>
                            Bulk Edit Budgets
                        </Button>
                    )}
                </div>
            </div>

            <Modal
                open={findReplaceOpen}
                onClose={() => setFindReplaceOpen(false)}
                title="Find & Replace Names"
                description="Applies to selected items, or all if none selected."
                footer={
                    <>
                        <Button variant="outline" onClick={() => setFindReplaceOpen(false)}>Cancel</Button>
                        <Button variant="primary" onClick={applyFindReplace}>Apply</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Field label="Find">
                        <Input value={findText} onChange={e => setFindText(e.target.value)} placeholder="Text to search for" />
                    </Field>
                    <Field label="Replace with">
                        <Input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="Replacement text" />
                    </Field>
                </div>
            </Modal>

            {entityType !== 'ads' && (
                <Modal
                    open={budgetIncrementOpen}
                    onClose={() => setBudgetIncrementOpen(false)}
                    title="Increase/Decrease Budgets"
                    description="Applies to selected items, or all if none selected."
                    footer={
                        <>
                            <Button variant="outline" onClick={() => setBudgetIncrementOpen(false)}>Cancel</Button>
                            <Button variant="primary" onClick={applyBudgetIncrement}>Apply</Button>
                        </>
                    }
                >
                    <Field label="Percentage (%)">
                        <Input
                            type="number"
                            value={budgetIncrement}
                            onChange={e => setBudgetIncrement(e.target.value)}
                            placeholder="e.g. 10 for +10%, -20 for -20%"
                        />
                    </Field>
                </Modal>
            )}

            <Card padding="none">
                <CardBody>
                    {loading ? (
                        <div className="p-4 space-y-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} height={40} width="100%" />
                            ))}
                        </div>
                    ) : (
                        <div ref={parentRef} className="h-[600px] overflow-auto">
                            <Table density="compact" stickyHeader>
                                <THead>
                                    <Tr>
                                        <Th width={40}>
                                            <Checkbox
                                                checked={allSelected}
                                                onChange={toggleSelectAll}
                                                aria-label="Select all"
                                            />
                                        </Th>
                                        <Th width={160}>ID</Th>
                                        <Th>Name</Th>
                                        <Th width={96}>Status</Th>
                                        {entityType !== 'ads' && <Th width={160}>Daily budget</Th>}
                                    </Tr>
                                </THead>
                                <TBody>
                                    {paddingTop > 0 && (
                                        <Tr aria-hidden="true">
                                            <Td colSpan={columnCount} style={{ height: paddingTop }} />
                                        </Tr>
                                    )}
                                    {virtualItems.map((virtualRow) => {
                                        const r = rows[virtualRow.index];
                                        return (
                                            <Tr
                                                key={r.id}
                                                selected={r.dirty}
                                                data-index={virtualRow.index}
                                                ref={rowVirtualizer.measureElement}
                                            >
                                                <Td>
                                                    <Checkbox
                                                        checked={selectedIds.has(r.id)}
                                                        onChange={() => toggleSelect(r.id)}
                                                        aria-label={`Select ${r.name}`}
                                                    />
                                                </Td>
                                                <Td truncate className="text-xs font-mono text-[var(--st-text-secondary)]">{r.id}</Td>
                                                <Td>
                                                    <EditableNameCell row={r} onUpdate={handleUpdateRow} />
                                                </Td>
                                                <Td>
                                                    <Badge tone={r.status === 'ACTIVE' ? 'success' : 'neutral'}>
                                                        {r.status}
                                                    </Badge>
                                                </Td>
                                                {entityType !== 'ads' && (
                                                    <Td>
                                                        <EditableBudgetCell row={r} onUpdate={handleUpdateRow} />
                                                    </Td>
                                                )}
                                            </Tr>
                                        );
                                    })}
                                    {paddingBottom > 0 && (
                                        <Tr aria-hidden="true">
                                            <Td colSpan={columnCount} style={{ height: paddingBottom }} />
                                        </Tr>
                                    )}
                                </TBody>
                            </Table>
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
