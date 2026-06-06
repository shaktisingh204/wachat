'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Plus, Trash2, Workflow } from 'lucide-react';
import { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button, useToast, PageHeading, PageTitle, PageDescription, PageHeader, PageActions, Table, TBody, Td, Th, THead, Tr, Input, Checkbox } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ShiftForm } from '../_components/shift-form';
import type { CrmShiftDoc } from '@/lib/rust-client/crm-shifts';

interface DraftShift extends Partial<CrmShiftDoc> {
    id: string; // Add an explicit id for key props
}

function FormClosedState({ onOpen }: { onOpen: () => void }) {
    return (
        <div className="flex items-center justify-center rounded-lg border border-[var(--st-border)] border-dashed bg-[var(--st-bg)] p-8 text-center text-[var(--st-text-secondary)] shadow-sm">
            <div className="max-w-xs">
                <Workflow className="mx-auto mb-4 h-8 w-8 opacity-50" />
                <p className="mb-4 text-sm">Form closed. Click "Add Draft" to create another shift.</p>
                <Button onClick={onOpen} variant="outline">
                    Open Form
                </Button>
            </div>
        </div>
    );
}

export default function NewShiftBulkPage() {
    const router = useRouter();
    const { toast } = useToast();
    
    const [drafts, setDrafts] = useState<DraftShift[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(true);
    const [filterQuery, setFilterQuery] = useState('');

    // Advanced filtering state
    const [showNightOnly, setShowNightOnly] = useState(false);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Advanced filtering states / collaborative editing via WebSockets
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/api/ws';
        let socket: WebSocket | null = null;
        try {
            socket = new WebSocket(wsUrl);
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'draft_updated') {
                        toast({ title: 'Collaborative Edit', description: 'Someone modified a draft.' });
                    } else if (data.type === 'bulk_action_sync') {
                        setDrafts([]);
                        setSelectedIds(new Set());
                        toast({ title: 'Remote sync', description: 'Drafts were cleared remotely.' });
                    }
                } catch (e) {
                    console.error('Invalid WS payload', e);
                }
            };
        } catch (e) {
            // fallback gracefully
        }
        return () => {
            if (socket) socket.close();
        };
    }, [toast]);

    // Derived state: memoize filtering of drafts
    const filteredDrafts = useMemo(() => {
        let result = drafts;
        
        if (showNightOnly) {
            result = result.filter(d => d.isNightShift);
        }

        if (filterQuery) {
            const q = filterQuery.toLowerCase();
            result = result.filter(
                (d) =>
                    d.name?.toLowerCase().includes(q) ||
                    d.code?.toLowerCase().includes(q)
            );
        }
        
        return result;
    }, [drafts, filterQuery, showNightOnly]);

    // Virtualization for performance if data grows large
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredDrafts.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 48, // approximate height of a table row
        overscan: 5,
    });

    const handleDraftAdded = (newDraft: Partial<CrmShiftDoc>) => {
        // Optimistic UI updates
        const draftWithId = { ...newDraft, id: crypto.randomUUID() };
        setDrafts((prev) => [...prev, draftWithId]);
        setIsFormOpen(false);
        toast({ title: 'Draft added', description: 'Shift saved to local queue.' });
    };

    const exportToCSV = () => {
        const targets = selectedIds.size > 0 
            ? drafts.filter(d => selectedIds.has(d.id))
            : drafts;

        if (targets.length === 0) {
            toast({ title: 'Export Failed', description: 'No drafts available to export.', variant: 'destructive' });
            return;
        }
        const headers = ['Name,Code,Start,End,Break,Grace,Night\n'];
        const rows = targets.map(
            (d) => `${d.name || ''},${d.code || ''},${d.startTime || ''},${d.endTime || ''},${d.breakMinutes || ''},${d.graceMinutes || ''},${d.isNightShift ? 'Yes' : 'No'}\n`
        );
        const csvContent = 'data:text/csv;charset=utf-8,' + headers.concat(rows).join('');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'shift-drafts.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Exported', description: 'CSV file downloaded successfully.' });
    };

    const exportToPDF = () => {
        const targets = selectedIds.size > 0 
            ? drafts.filter(d => selectedIds.has(d.id))
            : drafts;

        if (targets.length === 0) {
            toast({ title: 'Export Failed', description: 'No drafts available to export.', variant: 'destructive' });
            return;
        }
        // Mock PDF generation, practically we'd use jspdf or trigger print
        toast({ title: 'Exporting PDF...', description: `Generating PDF for ${targets.length} drafts.` });
        setTimeout(() => {
            window.print();
        }, 1000);
    };

    const clearDrafts = () => {
        setDrafts([]);
        setSelectedIds(new Set());
        toast({ title: 'Cleared', description: 'All drafts removed.' });
    };

    const handleBulkDelete = () => {
        setDrafts(prev => prev.filter(d => !selectedIds.has(d.id)));
        setSelectedIds(new Set());
        toast({ title: 'Deleted', description: 'Selected drafts were removed.' });
    };

    const toggleAllSelection = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredDrafts.map(d => d.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const toggleRowSelection = (id: string, checked: boolean) => {
        const next = new Set(selectedIds);
        if (checked) {
            next.add(id);
        } else {
            next.delete(id);
        }
        setSelectedIds(next);
    };

    const allSelected = filteredDrafts.length > 0 && selectedIds.size === filteredDrafts.length;
    const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredDrafts.length;

    return (
        <Suspense fallback={<div>Loading workspace...</div>}>
            <div className="flex h-full flex-col gap-6 p-6">
                <PageHeader>
                    <div>
                        <PageHeading>
                            <PageTitle>Create New Shifts</PageTitle>
                        </PageHeading>
                        <PageDescription>
                            Create a single shift or build a queue of draft shifts for bulk import.
                        </PageDescription>
                    </div>
                    <PageActions>
                        <Button variant="outline" onClick={() => router.push('/dashboard/hrm/payroll/shifts')}>
                            Back to List
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={exportToCSV}>
                                <Download className="mr-1.5 h-4 w-4" /> CSV
                            </Button>
                            <Button variant="outline" onClick={exportToPDF}>
                                <FileText className="mr-1.5 h-4 w-4" /> PDF
                            </Button>
                        </div>
                        <Button onClick={() => setIsFormOpen(true)}>
                            <Plus className="mr-1.5 h-4 w-4" /> Add Draft
                        </Button>
                    </PageActions>
                </PageHeader>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* LEFT PANEL: Form */}
                    {isFormOpen ? (
                        <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] p-4 shadow-sm">
                            <h2 className="mb-4 text-lg font-medium text-[var(--st-text)]">Shift Details</h2>
                            <ShiftForm 
                                initial={null} 
                                onSaved={() => {
                                    handleDraftAdded({
                                        name: `New Shift ${drafts.length + 1}`,
                                        code: `NEW-${drafts.length + 1}`,
                                        startTime: '09:00',
                                        endTime: '17:00',
                                        isNightShift: false
                                    });
                                }}
                                onCancel={() => setIsFormOpen(false)}
                            />
                        </div>
                    ) : (
                        <FormClosedState onOpen={() => setIsFormOpen(true)} />
                    )}

                    {/* RIGHT PANEL: Drafts / Session History */}
                    <div className="flex flex-col gap-4">
                        <EntityListShell
                            title="Recently Created / Drafts"
                            subtitle="Shifts added in this session"
                            search={{
                                value: filterQuery,
                                onChange: setFilterQuery,
                                placeholder: 'Filter by name or code...',
                            }}
                            filters={
                                <label className="flex items-center gap-2 rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1.5 text-[12px] font-medium text-[var(--st-text)]">
                                    <Checkbox
                                        checked={showNightOnly}
                                        onCheckedChange={(v) => setShowNightOnly(Boolean(v))}
                                    />
                                    Night Shifts Only
                                </label>
                            }
                            bulkBar={
                                selectedIds.size > 0 ? (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-[var(--st-text)]">
                                            {selectedIds.size} selected
                                        </span>
                                        <div className="flex gap-2">
                                            <Button variant="ghost" onClick={() => setSelectedIds(new Set())}>
                                                Cancel
                                            </Button>
                                            <Button variant="outline" className="text-[var(--st-danger)] border-[var(--st-danger)]/20 hover:bg-[var(--st-danger)]/10" onClick={handleBulkDelete}>
                                                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                                            </Button>
                                        </div>
                                    </div>
                                ) : null
                            }
                            primaryAction={
                                <Button variant="ghost" onClick={clearDrafts} disabled={drafts.length === 0}>
                                    Clear All
                                </Button>
                            }
                        >
                            <div 
                                ref={tableContainerRef}
                                className="h-[500px] overflow-auto rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)]"
                            >
                                <Table>
                                    <THead className="sticky top-0 z-10 bg-[var(--st-bg)] shadow-sm">
                                        <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                            <Th className="w-[40px]">
                                                <Checkbox 
                                                    role="checkbox"
                                                    checked={allSelected ? true : isIndeterminate ? "indeterminate" : false}
                                                    onCheckedChange={(v) => toggleAllSelection(Boolean(v))}
                                                    aria-label="Select all"
                                                />
                                            </Th>
                                            <Th className="text-[var(--st-text-secondary)]">Name</Th>
                                            <Th className="text-[var(--st-text-secondary)]">Code</Th>
                                            <Th className="text-[var(--st-text-secondary)]">Window</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {filteredDrafts.length === 0 ? (
                                            <Tr className="border-[var(--st-border)]">
                                                <Td colSpan={4} className="h-24 text-center text-[var(--st-text-secondary)]">
                                                    No drafts match this filter.
                                                </Td>
                                            </Tr>
                                        ) : (
                                            <>
                                                {rowVirtualizer.getVirtualItems().length > 0 && (
                                                    <tr>
                                                        <td style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start}px` }} colSpan={4} />
                                                    </tr>
                                                )}
                                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                                    const d = filteredDrafts[virtualRow.index];
                                                    const isSelected = selectedIds.has(d.id);
                                                    return (
                                                        <Tr 
                                                            key={d.id} 
                                                            className="border-[var(--st-border)]"
                                                            data-state={isSelected ? 'selected' : undefined}
                                                        >
                                                            <Td>
                                                                <Checkbox 
                                                                    role="checkbox"
                                                                    checked={isSelected}
                                                                    onCheckedChange={(v) => toggleRowSelection(d.id, Boolean(v))}
                                                                    aria-label={`Select ${d.name}`}
                                                                />
                                                            </Td>
                                                            <Td className="font-medium text-[var(--st-text)]">
                                                                {d.name}
                                                            </Td>
                                                            <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                                {d.code || '—'}
                                                            </Td>
                                                            <Td className="text-[var(--st-text)]">
                                                                {/* Hydration safe client-rendered string formatting */}
                                                                {String(d.startTime || '').padStart(5, '0')} – {String(d.endTime || '').padStart(5, '0')}
                                                            </Td>
                                                        </Tr>
                                                    );
                                                })}
                                                {rowVirtualizer.getVirtualItems().length > 0 && (
                                                    <tr>
                                                        <td style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end}px` }} colSpan={4} />
                                                    </tr>
                                                )}
                                            </>
                                        )}
                                    </TBody>
                                </Table>
                            </div>
                        </EntityListShell>
                    </div>
                </div>
            </div>
        </Suspense>
    );
}
