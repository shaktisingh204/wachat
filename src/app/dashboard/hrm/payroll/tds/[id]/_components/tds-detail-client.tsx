'use client';

import React, { useState, useMemo, useEffect, useTransition, useRef } from 'react';
import { Card, Button, Input, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { Download, Edit2, Search, Trash, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { InlineTdsForm } from './inline-tds-form';
import { useVirtualizer } from '@tanstack/react-virtual';
import { saveTdsRecord, deleteTdsRecord } from '@/app/actions/crm-tds.actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtDate, fmtINR } from '@/lib/utils';

type CrmTdsStatus = 'pending' | 'deposited' | 'filed' | 'archived';

const STATUS_TONE: Record<string, StatusTone> = {
    pending: 'amber',
    deposited: 'blue',
    filed: 'green',
    archived: 'neutral',
};

function inr(n: unknown): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
    return `${fmtINR(n)}`;
}

function useClientDate(value: unknown) {
    const [dateStr, setDateStr] = useState('—');
    useEffect(() => {
        if (!value) return;
        const d = new Date(value as string);
        setDateStr(Number.isNaN(d.getTime()) ? '—' : fmtDate(d));
    }, [value]);
    return dateStr;
}

function DateDisplay({ value }: { value: unknown }) {
    const formatted = useClientDate(value);
    return <span>{formatted}</span>;
}

export function TdsDetailClient({
    row,
    initialFyView,
    employeeName,
    financialYear,
    employeeId,
    fyTotal,
}: {
    row: any;
    initialFyView: any[];
    employeeName: string;
    financialYear: string;
    employeeId: string;
    fyTotal: number;
}) {
    const [fyView, setFyView] = useState(initialFyView);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();
    const [editingId, setEditingId] = useState<string | null>(null);
    const parentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ws = new WebSocket(
            process.env.NEXT_PUBLIC_WS_URL || 'wss://echo.websocket.events'
        );
        ws.onopen = () => {
            console.log('WS Connected for collaborative editing');
        };
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'TDS_UPDATED' && data.payload) {
                    setFyView((prev) => 
                        prev.map(item => String(item._id) === String(data.payload._id) ? { ...item, ...data.payload } : item)
                    );
                    toast.info('A record was updated collaboratively.');
                }
            } catch (e) {}
        };
        return () => ws.close();
    }, []);

    const filteredView = useMemo(() => {
        if (!search) return fyView;
        const lowerSearch = search.toLowerCase();
        return fyView.filter((q) => 
            String(q.quarter || '').toLowerCase().includes(lowerSearch) ||
            String(q.status || '').toLowerCase().includes(lowerSearch)
        );
    }, [fyView, search]);

    const rowVirtualizer = useVirtualizer({
        count: filteredView.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 53,
        overscan: 5,
    });

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredView.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredView.map((q) => String(q._id))));
        }
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        if (!confirm('Are you sure you want to delete selected records?')) return;
        
        const idsToDelete = Array.from(selectedIds);
        const prevView = [...fyView];
        
        startTransition(() => {
            setFyView((prev) => prev.filter(q => !idsToDelete.includes(String(q._id))));
            setSelectedIds(new Set());
        });

        Promise.all(idsToDelete.map(id => deleteTdsRecord(id)))
            .then((results) => {
                const hasError = results.some(r => !r.success);
                if (hasError) {
                    toast.error('Some records failed to delete. Rolling back.');
                    setFyView(prevView);
                } else {
                    toast.success(`Successfully deleted ${idsToDelete.length} records.`);
                }
            })
            .catch(() => {
                toast.error('Failed to delete records. Rolling back.');
                setFyView(prevView);
            });
    };

    const handleBulkStatusUpdate = (newStatus: string) => {
        if (selectedIds.size === 0) return;
        
        const idsToUpdate = Array.from(selectedIds);
        const prevView = [...fyView];
        
        startTransition(() => {
            setFyView(prev => prev.map(item => 
                idsToUpdate.includes(String(item._id)) ? { ...item, status: newStatus } : item
            ));
            setSelectedIds(new Set());
        });

        const promises = idsToUpdate.map(id => {
            const record = prevView.find(q => String(q._id) === id);
            if (!record) return Promise.resolve({ error: 'Not found' });
            
            const formData = new FormData();
            formData.append('recordId', id);
            formData.append('employeeName', employeeName);
            if (record.employeeId) formData.append('employeeId', record.employeeId);
            formData.append('financialYear', financialYear);
            formData.append('quarter', record.quarter || '');
            formData.append('grossAmount', String(record.grossAmount || 0));
            formData.append('tdsAmount', String(record.tdsAmount || 0));
            if (record.certificateNumber) formData.append('certificateNumber', record.certificateNumber);
            if (record.depositChallanNumber) formData.append('depositChallanNumber', record.depositChallanNumber);
            if (record.depositDate) formData.append('depositDate', record.depositDate);
            formData.append('status', newStatus);
            if (record.notes) formData.append('notes', record.notes);
            
            return saveTdsRecord(undefined, formData);
        });

        Promise.all(promises)
            .then(results => {
                const errors = results.filter(r => r.error);
                if (errors.length > 0) {
                    toast.error(`Failed to update ${errors.length} records. Rolling back.`);
                    setFyView(prevView);
                } else {
                    toast.success(`Successfully updated status for ${idsToUpdate.length} records.`);
                }
            })
            .catch(() => {
                toast.error('Failed to update status. Rolling back.');
                setFyView(prevView);
            });
    };

    const handleInlineSave = async (updatedRecord: any) => {
        const prevView = [...fyView];
        
        startTransition(() => {
            setFyView((prev) =>
                prev.map((item) =>
                    String(item._id) === String(updatedRecord._id) ? updatedRecord : item
                )
            );
            setEditingId(null);
        });

        const formData = new FormData();
        formData.append('recordId', String(updatedRecord._id));
        formData.append('employeeName', employeeName);
        if (updatedRecord.employeeId) formData.append('employeeId', updatedRecord.employeeId);
        formData.append('financialYear', financialYear);
        formData.append('quarter', updatedRecord.quarter || '');
        formData.append('grossAmount', String(updatedRecord.grossAmount || 0));
        formData.append('tdsAmount', String(updatedRecord.tdsAmount || 0));
        if (updatedRecord.certificateNumber) formData.append('certificateNumber', updatedRecord.certificateNumber);
        if (updatedRecord.depositChallanNumber) formData.append('depositChallanNumber', updatedRecord.depositChallanNumber);
        if (updatedRecord.depositDate) formData.append('depositDate', updatedRecord.depositDate);
        formData.append('status', updatedRecord.status || 'pending');
        if (updatedRecord.notes) formData.append('notes', updatedRecord.notes);

        try {
            const res = await saveTdsRecord(undefined, formData);
            if (res?.error) {
                toast.error(res.error);
                setFyView(prevView);
            } else {
                toast.success('Record updated successfully!');
            }
        } catch (e) {
            toast.error('Failed to update record');
            setFyView(prevView);
        }
    };

    const exportCSV = () => {
        if (filteredView.length === 0) {
            toast.error('No records to export');
            return;
        }
        const headers = ['Quarter', 'Gross Amount', 'TDS Amount', 'Status', 'Deposit Date'];
        const csvRows = [headers.join(',')];
        
        for (const q of filteredView) {
            const d = new Date(q.depositDate as string);
            const dateStr = !q.depositDate || Number.isNaN(d.getTime()) ? '' : fmtDate(d);
            csvRows.push([
                q.quarter || '',
                q.grossAmount || 0,
                q.tdsAmount || 0,
                q.status || '',
                dateStr
            ].join(','));
        }
        
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TDS_${employeeName}_FY${financialYear}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported successfully');
    };

    const exportPDF = () => {
        if (filteredView.length === 0) {
            toast.error('No records to export');
            return;
        }
        const doc = new jsPDF();
        doc.text(`TDS Details: ${employeeName} - FY ${financialYear}`, 14, 15);
        
        const tableColumn = ["Quarter", "Gross Amount", "TDS Amount", "Status", "Deposit Date"];
        const tableRows: any[] = [];
        
        filteredView.forEach(q => {
            const d = new Date(q.depositDate as string);
            const dateStr = !q.depositDate || Number.isNaN(d.getTime()) ? '' : fmtDate(d);
            const rowData = [
                q.quarter || '',
                fmtINR(q.grossAmount as number) || '0',
                fmtINR(q.tdsAmount as number) || '0',
                q.status || '',
                dateStr
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 20,
        });

        doc.save(`TDS_${employeeName}_FY${financialYear}.pdf`);
        toast.success('PDF exported successfully');
    };

    const status = (row.status as CrmTdsStatus | undefined) ?? 'pending';
    const tone = STATUS_TONE[status] ?? 'neutral';

    return (
        <div className="space-y-6">
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-zoru-ink">Overview</div>
                    <StatusPill label={status} tone={tone} />
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-zoru-ink-muted">Gross amount</div>
                        <div className="font-mono text-zoru-ink">{inr(row.grossAmount)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">TDS amount</div>
                        <div className="font-mono text-zoru-ink">{inr(row.tdsAmount)}</div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Certificate number</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {(row.certificateNumber as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Deposit challan</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {(row.depositChallanNumber as string | undefined) ?? '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Deposit date</div>
                        <div className="text-zoru-ink"><DateDisplay value={row.depositDate} /></div>
                    </div>
                    <div>
                        <div className="text-zoru-ink-muted">Employee ID</div>
                        <div className="font-mono text-[12px] text-zoru-ink">
                            {employeeId || '—'}
                        </div>
                    </div>
                    {row.notes ? (
                        <div className="sm:col-span-2">
                            <div className="text-zoru-ink-muted">Notes</div>
                            <div className="whitespace-pre-wrap text-zoru-ink">
                                {row.notes as string}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Card>

            {fyView.length > 0 ? (
                <Card className="p-6">
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-[14px] font-medium text-zoru-ink">
                                Quarterly view — {employeeName} · FY {financialYear}
                            </div>
                            <div className="text-[12.5px] text-zoru-ink-muted">
                                FY total:{' '}
                                <span className="font-mono text-zoru-ink">{inr(fyTotal)}</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                                <Input
                                    type="text"
                                    placeholder="Filter by quarter/status..."
                                    className="pl-9 text-sm"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <Button variant="secondary" size="sm" onClick={exportCSV}>
                                <Download className="mr-2 h-4 w-4" />
                                CSV
                            </Button>
                            <Button variant="secondary" size="sm" onClick={exportPDF}>
                                <FileText className="mr-2 h-4 w-4" />
                                PDF
                            </Button>
                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-2">
                                    <Select onValueChange={handleBulkStatusUpdate}>
                                        <SelectTrigger className="h-8 w-[130px] text-[13px]">
                                            <SelectValue placeholder="Update Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="deposited">Deposited</SelectItem>
                                            <SelectItem value="filed">Filed</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                                        <Trash className="mr-2 h-4 w-4" />
                                        Delete ({selectedIds.size})
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div ref={parentRef} className="overflow-x-auto rounded-lg border border-zoru-line max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-[13px] relative">
                            <thead className="sticky top-0 z-10">
                                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                    <th className="w-10 px-4 py-2">
                                        <Checkbox
                                            checked={selectedIds.size === filteredView.length && filteredView.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Select all"
                                        />
                                    </th>
                                    <th className="px-4 py-2 text-[12px] uppercase text-zoru-ink-muted">
                                        Quarter
                                    </th>
                                    <th className="px-4 py-2 text-right text-[12px] uppercase text-zoru-ink-muted">
                                        Gross
                                    </th>
                                    <th className="px-4 py-2 text-right text-[12px] uppercase text-zoru-ink-muted">
                                        TDS
                                    </th>
                                    <th className="px-4 py-2 text-[12px] uppercase text-zoru-ink-muted">
                                        Status
                                    </th>
                                    <th className="px-4 py-2 text-right text-[12px] uppercase text-zoru-ink-muted">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    position: 'relative',
                                }}
                            >
                                {filteredView.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-zoru-ink-muted">
                                            No records found.
                                        </td>
                                    </tr>
                                ) : (
                                    rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                        const q = filteredView[virtualRow.index];
                                        return (
                                        editingId === String(q._id) ? (
                                            <InlineTdsForm
                                                key={`edit-${String(q._id)}`}
                                                record={q}
                                                onSave={handleInlineSave}
                                                onCancel={() => setEditingId(null)}
                                                // We must map it appropriately for virtualized styles if we want strict pos
                                                // But since table TR absolute positioning with virtualizer is tricky,
                                                // often we use transform or just standard TR inside virtualizer wrapper
                                            />
                                        ) : (
                                        <tr
                                            key={String(q._id)}
                                            className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors"
                                            // Optional: apply virtual row transform if needed for true virtualization
                                            // style={{
                                            //    position: 'absolute',
                                            //    top: 0,
                                            //    left: 0,
                                            //    width: '100%',
                                            //    transform: `translateY(${virtualRow.start}px)`,
                                            // }}
                                        >
                                            <td className="px-4 py-2">
                                                <Checkbox
                                                    checked={selectedIds.has(String(q._id))}
                                                    onCheckedChange={() => toggleSelect(String(q._id))}
                                                    aria-label={`Select record for ${q.quarter}`}
                                                />
                                            </td>
                                            <td className="px-4 py-2 font-mono text-zoru-ink">
                                                {(q.quarter as string | undefined) ?? '—'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-zoru-ink">
                                                {inr(q.grossAmount)}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-zoru-ink">
                                                {inr(q.tdsAmount)}
                                            </td>
                                            <td className="px-4 py-2">
                                                <StatusPill
                                                    label={(q.status as string | undefined) ?? '—'}
                                                    tone={
                                                        STATUS_TONE[
                                                            (q.status ?? 'pending') as string
                                                        ] ?? 'neutral'
                                                    }
                                                />
                                            </td>
                                            <td className="px-4 py-2 flex items-center justify-end gap-2 text-zoru-ink-muted">
                                                <span className="mr-2 text-[11px]"><DateDisplay value={q.depositDate} /></span>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => setEditingId(String(q._id))}
                                                    aria-label="Edit record"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                        )
                                    )})
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : null}
        </div>
    );
}
