'use client';

import * as React from 'react';
import { useOptimistic, useTransition, useMemo, useRef } from 'react';
import {
    ZoruAlertDialog,
    ZoruAlertDialogAction,
    ZoruAlertDialogCancel,
    ZoruAlertDialogContent,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    Badge,
    Button,
    Checkbox,
    Input,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
    Edit,
    LoaderCircle,
    Plus,
    Trash2,
    Download,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import { deleteShift, getShifts } from '@/app/actions/crm-shifts.actions';
import type { CrmShiftDoc, CrmShiftStatus } from '@/lib/rust-client/crm-shifts';
import { ShiftDialog } from './shift-form-dialog';
import { useShiftsWebsocket } from './use-shifts-websocket';

const STATUS_TONE: Record<CrmShiftStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

function dayBadges(days: string[] | undefined): React.ReactNode {
    const list = days ?? [];
    if (list.length === 0) {
        return <span className="text-[12.5px] text-zoru-ink-muted">—</span>;
    }
    if (list.length === 7) {
        return <Badge variant="info">All days</Badge>;
    }
    return (
        <div className="flex flex-wrap gap-1">
            {list.map((d) => (
                <Badge key={d} variant="info">
                    {d.slice(0, 3)}
                </Badge>
            ))}
        </div>
    );
}

export default function ShiftsClient({ initialShifts }: { initialShifts: CrmShiftDoc[] }) {
    const { shifts, setShifts } = useShiftsWebsocket(initialShifts);
    
    // UI State
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmShiftStatus | 'all'>('all');
    const [isNightFilter, setIsNightFilter] = React.useState<boolean | 'all'>('all');
    
    const [editing, setEditing] = React.useState<CrmShiftDoc | null>(null);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    
    const [pendingDelete, setPendingDelete] = React.useState<CrmShiftDoc | null>(null);
    const [deletePending, startDeleteTransition] = useTransition();

    // Bulk actions
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

    const { toast } = useZoruToast();

    // Refresh function for manual sync if necessary
    const refresh = React.useCallback(async () => {
        try {
            const res = await getShifts({ limit: 500 });
            setShifts(res.items ?? []);
        } catch (error) {
            console.error(error);
        }
    }, [setShifts]);

    const handleOpenDialog = (s: CrmShiftDoc | null) => {
        setEditing(s);
        setDialogOpen(true);
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        
        addOptimisticShift({ type: "delete", id });
        startDeleteTransition(async () => {
            const result = await deleteShift(id);
            if (result.success) {
                toast({ title: 'Shift deleted' });
                setPendingDelete(null);
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setShifts(prev => prev.filter(s => s._id !== id));
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete shift.',
                    variant: 'destructive',
                });
            }
        });
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        addOptimisticShift({ type: "delete", ids: Array.from(selectedIds) });
        startDeleteTransition(async () => {
            let successCount = 0;
            for (const id of Array.from(selectedIds)) {
                const res = await deleteShift(id);
                if (res.success) {
                    successCount++;
                    setShifts(prev => prev.filter(s => s._id !== id));
                }
            }
            setSelectedIds(new Set());
            toast({ title: `Deleted ${successCount} shift(s)` });
        });
    };

    const [optimisticShifts, addOptimisticShift] = useOptimistic(
        shifts,
        (state, action: { type: "delete", id?: string, ids?: string[] }) => {
            if (action.type === "delete") {
                if (action.ids) { return state.filter(s => !action.ids!.includes(s._id)); } return state.filter(s => s._id !== action.id);
            }
            return state;
        }
    );

    const filteredShifts = useMemo(() => {
        return optimisticShifts.filter(s => {
            const matchSearch = search ? (s.name?.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase())) : true;
            const matchStatus = statusFilter === 'all' ? true : s.status === statusFilter;
            const matchNight = isNightFilter === 'all' ? true : (!!s.isNightShift === isNightFilter);
            return matchSearch && matchStatus && matchNight;
        });
    }, [shifts, search, statusFilter, isNightFilter]);

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredShifts.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64, // Approximate row height
        overscan: 5,
    });

    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredShifts.map(s => s._id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const toggleSelect = (id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const exportCSV = () => {
        const data = filteredShifts.map(s => ({
            Name: s.name,
            Code: s.code || '',
            Start: s.startTime,
            End: s.endTime,
            Break: s.breakMinutes || 0,
            Grace: s.graceMinutes || 0,
            Status: s.status || 'active'
        }));
        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'shifts.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        (doc as any).autoTable({
            head: [['Name', 'Code', 'Window', 'Break/Grace', 'Status']],
            body: filteredShifts.map(s => [
                s.name, 
                s.code || '', 
                `${s.startTime} - ${s.endTime}`, 
                `${s.breakMinutes || 0}m / ${s.graceMinutes || 0}m`, 
                s.status || 'active'
            ]),
        });
        doc.save('shifts.pdf');
    };

    return (
        <>
            <ShiftDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSaved={refresh}
                initial={editing}
            />

            <EntityListShell
                title="Shifts"
                description="Manage employee working hours and rotation masters."
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> CSV</Button>
                        <Button variant="outline" onClick={exportPDF}><Download className="mr-2 h-4 w-4" /> PDF</Button>
                        <Button onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New shift
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-full max-w-sm">
                            <Input
                                placeholder="Search shifts..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="w-40">
                            <EnumFilterField
                                enumName="activeArchived"
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v as any)}
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zoru-ink">
                            <Checkbox 
                                id="nightFilter"
                                checked={isNightFilter === true}
                                onCheckedChange={(c) => {
                                    if (c) setIsNightFilter(true);
                                    else setIsNightFilter('all');
                                }}
                            />
                            <label htmlFor="nightFilter" className="cursor-pointer">Night Shift Only</label>
                        </div>
                        
                        {selectedIds.size > 0 && (
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={handleBulkDelete}
                                disabled={deletePending}
                                className="ml-auto"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected ({selectedIds.size})
                            </Button>
                        )}
                    </div>

                    <div 
                        className="rounded-md border border-zoru-line bg-zoru-surface overflow-auto" 
                        style={{ height: '600px' }}
                        ref={parentRef}
                    >
                        <Table>
                            <ZoruTableHeader className="sticky top-0 bg-zoru-surface z-10 shadow-sm">
                                <ZoruTableRow>
                                    <ZoruTableHead className="w-10 text-center">
                                        <Checkbox 
                                            checked={filteredShifts.length > 0 && selectedIds.size === filteredShifts.length}
                                            onCheckedChange={(c) => toggleSelectAll(!!c)}
                                        />
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Code</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Window</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Break / Grace</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Days</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            
                            <ZoruTableBody>
                                {filteredShifts.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={8} className="h-24 text-center text-zoru-ink-muted">
                                            No shifts match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    <>
                                        {/* Virtual padding top */}
                                        {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getVirtualItems()[0].start > 0 && (
                                            <ZoruTableRow>
                                                <ZoruTableCell colSpan={8} style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px`, padding: 0 }} />
                                            </ZoruTableRow>
                                        )}
                                        
                                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const s = filteredShifts[virtualRow.index];
                                            const status = (s.status ?? 'active') as CrmShiftStatus;
                                            const tone = STATUS_TONE[status] ?? 'neutral';
                                            
                                            return (
                                                <ZoruTableRow key={s._id} className="border-zoru-line">
                                                    <ZoruTableCell className="text-center">
                                                        <Checkbox 
                                                            checked={selectedIds.has(s._id)}
                                                            onCheckedChange={(c) => toggleSelect(s._id, !!c)}
                                                        />
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="font-medium text-zoru-ink">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                aria-hidden
                                                                className="inline-block h-4 w-4 rounded-[4px] border border-zoru-line"
                                                                style={{ backgroundColor: s.color || '#EAB308' }}
                                                            />
                                                            <span>{s.name}</span>
                                                            {s.isDefault && <Badge variant="info">default</Badge>}
                                                            {s.isNightShift && <Badge variant="secondary">night</Badge>}
                                                        </div>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                        {s.code || '—'}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-zoru-ink">
                                                        {s.startTime} – {s.endTime}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-zoru-ink">
                                                        {(s.breakMinutes ?? 0)}m break · {(s.graceMinutes ?? 0)}m grace
                                                    </ZoruTableCell>
                                                    <ZoruTableCell>{dayBadges(s.workingDays)}</ZoruTableCell>
                                                    <ZoruTableCell>
                                                        <StatusPill label={status} tone={tone} />
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(s)} aria-label="Edit shift">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => setPendingDelete(s)} aria-label="Delete shift">
                                                            <Trash2 className="h-4 w-4 text-zoru-ink" />
                                                        </Button>
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            );
                                        })}
                                        
                                        {/* Virtual padding bottom */}
                                        {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end > 0 && (
                                            <ZoruTableRow>
                                                <ZoruTableCell colSpan={8} style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`, padding: 0 }} />
                                            </ZoruTableRow>
                                        )}
                                    </>
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </div>
            </EntityListShell>

            <ZoruAlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete shift?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will remove it from the
                            shift master list. Employees currently assigned to this shift will
                            need to be re-mapped.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
