'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Badge,
  Button,
  Card,
  Input,
  Checkbox,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useState,
  useEffect,
  useTransition,
  useOptimistic,
  useRef,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit,
  Search,
  Download,
  ListChecks,
  X,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { deleteSalaryStructure } from '@/app/actions/crm-payroll.actions';
import type { WithId, CrmSalaryStructure } from '@/lib/definitions';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StructureFormDialog } from './structure-form-dialog';

export function SalaryStructureClient({
    initialStructures,
}: {
    initialStructures: WithId<CrmSalaryStructure>[];
}) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<WithId<CrmSalaryStructure> | null>(null);
    const [pending, startTransition] = useTransition();

    const [optimisticStructures, addOptimisticStructure] = useOptimistic(
        initialStructures,
        (state, action: { type: 'delete' | 'delete_bulk'; payload: any }) => {
            if (action.type === 'delete') {
                return state.filter(s => s._id.toString() !== action.payload);
            }
            if (action.type === 'delete_bulk') {
                return state.filter(s => !action.payload.includes(s._id.toString()));
            }
            return state;
        }
    );

    // Advanced Filtering
    const [searchQuery, setSearchQuery] = useState('');
    
    const filteredStructures = useMemo(() => {
        return optimisticStructures.filter(s => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!s.name.toLowerCase().includes(q) && !(s.description && s.description.toLowerCase().includes(q))) {
                    return false;
                }
            }
            return true;
        });
    }, [optimisticStructures, searchQuery]);

    // Bulk Actions
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const ids = useMemo(() => filteredStructures.map(s => s._id.toString()), [filteredStructures]);
    const headChecked = ids.length > 0 && ids.every(id => selected.has(id));

    const toggleOne = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = (on: boolean) => {
        setSelected(on ? new Set(ids) : new Set());
    };

    const bulkDelete = () => {
        if (selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} structure${selected.size === 1 ? '' : 's'}?`)) return;
        
        const targets = Array.from(selected);
        startTransition(async () => {
            addOptimisticStructure({ type: 'delete_bulk', payload: targets });
            let ok = 0;
            let failed = 0;
            for (const id of targets) {
                const res = await deleteSalaryStructure(id);
                if (res.success) ok += 1;
                else failed += 1;
            }
            toast({
                title: failed === 0 ? `${ok} deleted` : `${ok} deleted, ${failed} failed`,
                variant: failed > 0 ? 'destructive' : undefined,
            });
            setSelected(new Set());
            router.refresh();
        });
    };

    const bulkExport = () => {
        if (selected.size === 0) return;
        const targets = filteredStructures.filter(s => selected.has(s._id.toString()));
        const csvRows = ['Name,Description,Earnings Count,Deductions Count'];
        targets.forEach(t => {
            const earnings = t.components?.filter(c => c.type === 'earning').length ?? 0;
            const deductions = t.components?.filter(c => c.type === 'deduction').length ?? 0;
            csvRows.push(`"${t.name}","${t.description ?? ''}",${earnings},${deductions}`);
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_structures_export_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Export successful' });
    };

    const bulkExportPDF = () => {
        if (selected.size === 0) return;
        const targets = filteredStructures.filter(s => selected.has(s._id.toString()));
        import('jspdf').then(({ default: jsPDF }) => {
            import('jspdf-autotable').then(({ default: autoTable }) => {
                const doc = new jsPDF();
                doc.text("Salary Structures", 14, 15);
                const tableData = targets.map(t => {
                    const earnings = t.components?.filter(c => c.type === 'earning').length ?? 0;
                    const deductions = t.components?.filter(c => c.type === 'deduction').length ?? 0;
                    return [t.name, t.description ?? '', earnings.toString(), deductions.toString()];
                });
                autoTable(doc, {
                    head: [['Name', 'Description', 'Earnings Count', 'Deductions Count']],
                    body: tableData,
                    startY: 20,
                });
                doc.save(`salary_structures_${Date.now()}.pdf`);
                toast({ title: 'PDF exported successfully' });
            });
        });
    };

    // Real-time Updates Placeholder
    useEffect(() => {
        let ws: WebSocket;
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Simulated websocket connection for collaborative editing
            ws = new WebSocket(`${protocol}//${window.location.host}/api/realtime/salary-structures`);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'update') {
                        router.refresh();
                    }
                } catch (e) {
                    console.error('Failed to parse websocket message', e);
                }
            };
        } catch (e) {
            console.error('Failed to connect WebSocket', e);
        }
        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [router]);

    const handleEdit = (structure: WithId<CrmSalaryStructure> | null) => {
        setEditingStructure(structure);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        startTransition(async () => {
            addOptimisticStructure({ type: 'delete', payload: id });
            const result = await deleteSalaryStructure(id);
            if (result.success) {
                toast({ title: 'Success', description: 'Structure deleted.' });
                router.refresh();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    // Virtualized List
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredStructures.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56, // row height
        overscan: 5,
    });
    const virtualItems = rowVirtualizer.getVirtualItems();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
    const paddingBottom = virtualItems.length > 0 ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0) : 0;

    return (
        <>
            <StructureFormDialog
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSave={() => router.refresh()}
                structure={editingStructure}
            />
            <EntityListShell
                title="Salary Structures"
                subtitle="Define salary templates with earnings and deductions for different employee roles or grades."
                primaryAction={
                    <Button onClick={() => handleEdit(null)}>
                        <Plus className="h-4 w-4" />
                        Create New Structure
                    </Button>
                }
            >
                {selected.size > 0 ? (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--st-shadow-sm)]">
                        <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
                            <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
                            {selected.size} selected
                        </div>
                        <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={bulkExport} disabled={pending}>
                                <Download className="h-3.5 w-3.5" /> CSV
                            </Button>
                            <Button size="sm" variant="outline" onClick={bulkExportPDF} disabled={pending}>
                                <Download className="h-3.5 w-3.5" /> PDF
                            </Button>
                            <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={pending}>
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                ) : null}

                <Card className="p-0 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[var(--st-border)] flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div>
                            <h2 className="text-[16px] text-[var(--st-text)]">Your Structures</h2>
                            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                                {filteredStructures.length} structure{filteredStructures.length !== 1 ? 's' : ''} defined.
                            </p>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                            <Input
                                placeholder="Search structures..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-[13px] rounded-lg border-[var(--st-border)] bg-[var(--st-bg)]"
                            />
                        </div>
                    </div>

                    <div ref={parentRef} className="max-h-[600px] overflow-auto relative rounded-b-lg">
                        <table className="w-full text-left text-[13px]">
                            <thead className="sticky top-0 bg-[var(--st-bg-muted)] z-10 shadow-sm border-b border-[var(--st-border)]">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <Checkbox
                                            checked={headChecked}
                                            onCheckedChange={(c) => toggleAll(Boolean(c))}
                                            aria-label="Select all"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Name</th>
                                    <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Description</th>
                                    <th className="px-4 py-3 text-center text-[12px] uppercase text-[var(--st-text-secondary)]">Earnings</th>
                                    <th className="px-4 py-3 text-center text-[12px] uppercase text-[var(--st-text-secondary)]">Deductions</th>
                                    <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Components</th>
                                    <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStructures.length > 0 ? (
                                    <>
                                        {paddingTop > 0 && <tr><td style={{ height: `${paddingTop}px` }} /></tr>}
                                        {virtualItems.map((virtualRow) => {
                                            const s = filteredStructures[virtualRow.index];
                                            const earnings = s.components?.filter(c => c.type === 'earning') ?? [];
                                            const deductions = s.components?.filter(c => c.type === 'deduction') ?? [];
                                            const id = s._id.toString();
                                            const isSelected = selected.has(id);

                                            return (
                                                <tr key={id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleOne(id)}
                                                            aria-label={`Select ${s.name}`}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-[var(--st-text)]">{s.name}</td>
                                                    <td className="px-4 py-3 text-[var(--st-text-secondary)]">{s.description ?? '—'}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant="success">{earnings.length} earning{earnings.length !== 1 ? 's' : ''}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant="danger">{deductions.length} deduction{deductions.length !== 1 ? 's' : ''}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(s.components ?? []).slice(0, 3).map((c) => (
                                                                <Badge key={c.name} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{c.name}</Badge>
                                                            ))}
                                                            {(s.components?.length ?? 0) > 3 && (
                                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">+{(s.components?.length ?? 0) - 3} more</Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <ZoruAlertDialog>
                                                                <ZoruAlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="text-[var(--st-danger)] hover:text-[var(--st-danger)]">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </ZoruAlertDialogTrigger>
                                                                <ZoruAlertDialogContent>
                                                                    <ZoruAlertDialogHeader>
                                                                        <ZoruAlertDialogTitle>Delete Structure?</ZoruAlertDialogTitle>
                                                                        <ZoruAlertDialogDescription>
                                                                            This will delete the "{s.name}" structure. It won't affect past payrolls.
                                                                        </ZoruAlertDialogDescription>
                                                                    </ZoruAlertDialogHeader>
                                                                    <ZoruAlertDialogFooter>
                                                                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                                                        <ZoruAlertDialogAction onClick={() => handleDelete(id)}>Delete</ZoruAlertDialogAction>
                                                                    </ZoruAlertDialogFooter>
                                                                </ZoruAlertDialogContent>
                                                            </ZoruAlertDialog>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {paddingBottom > 0 && <tr><td style={{ height: `${paddingBottom}px` }} /></tr>}
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                                            {searchQuery ? 'No structures match your search.' : 'No salary structures created yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </EntityListShell>
        </>
    );
}
