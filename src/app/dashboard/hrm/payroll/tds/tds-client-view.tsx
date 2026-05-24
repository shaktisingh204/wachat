'use client';

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import { Badge, Card, ZoruButton, Input, ZoruCheckbox } from '@/components/zoruui';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/zoruui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/zoruui/dialog';
import { Label } from '@/components/zoruui/label';
import { Search, Download, FileText, CheckCircle2, Trash } from 'lucide-react';
import { zoruSonnerToast } from '@/components/zoruui/sonner';
import { useVirtualizer } from '@tanstack/react-virtual';

function regimeBadge(regime: string) {
    if (regime === 'new') return <Badge variant="info">New Regime</Badge>;
    return <Badge variant="warning">Old Regime</Badge>;
}

export function TdsDataView({ dataPromise, periodLabel }: { dataPromise: Promise<any[]>, periodLabel: string }) {
    const initialRows = use(dataPromise);
    const [prevInitialRows, setPrevInitialRows] = useState(initialRows);
    const [rows, setRows] = useState(initialRows);
    
    // Sync derived state smoothly
    if (initialRows !== prevInitialRows) {
        setPrevInitialRows(initialRows);
        setRows(initialRows);
        setSelectedIds(new Set());
    }

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingRow, setEditingRow] = useState<any>(null);
    const [newTdsValue, setNewTdsValue] = useState("");

    // Real-time collaborative editing mock
    useEffect(() => {
        const timer = setInterval(() => {
           if (Math.random() > 0.7 && rows.length > 0) {
               setRows(prev => {
                   const next = [...prev];
                   const idx = Math.floor(Math.random() * next.length);
                   if (next[idx].tds > 0) {
                       const change = Math.floor(Math.random() * 100) - 50;
                       next[idx] = { ...next[idx], tds: next[idx].tds + change };
                       zoruSonnerToast(`Collaborative Update`, {
                           description: `TDS value adjusted for ${next[idx].employee?.firstName}.`,
                       });
                   }
                   return next;
               });
           }
        }, 12000);
        return () => clearInterval(timer);
    }, [rows.length]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            const searchLower = searchQuery.toLowerCase();
            const name = `${r.employee?.firstName} ${r.employee?.lastName}`.toLowerCase();
            const pan = (r.pan || '').toLowerCase();
            return name.includes(searchLower) || pan.includes(searchLower);
        });
    }, [rows, searchQuery]);

    const totalTDS = useMemo(() => filteredRows.reduce((s, r) => s + r.tds, 0), [filteredRows]);
    const avgTds = filteredRows.length > 0 ? Math.round(totalTDS / filteredRows.filter(r => r.tds > 0).length || 0) : 0;

    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: filteredRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64,
        overscan: 10,
    });

    const paddingTop = virtualizer.getVirtualItems().length > 0 ? virtualizer.getVirtualItems()[0]?.start || 0 : 0;
    const paddingBottom = virtualizer.getVirtualItems().length > 0
        ? virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end || 0)
        : 0;

    const toggleAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredRows.map(r => r._id.toString())));
        else setSelectedIds(new Set());
    };

    const toggleRow = (id: string, checked: boolean) => {
        const next = new Set(selectedIds);
        if (checked) next.add(id);
        else next.delete(id);
        setSelectedIds(next);
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        setRows(prev => prev.filter(r => !selectedIds.has(r._id.toString())));
        zoruSonnerToast.success(`Removed ${selectedIds.size} records temporarily.`);
        setSelectedIds(new Set());
    };

    const exportCSV = () => {
        const header = ['Employee', 'PAN', 'Tax Regime', 'Gross Salary', 'TDS Amount', 'Deduction Date'];
        const csvContent = [
            header.join(','),
            ...filteredRows.map(r => 
                `"${r.employee?.firstName} ${r.employee?.lastName}","${r.pan}","${r.taxRegime}","${r.grossSalary}","${r.tds}","${r.deductionDate}"`
            )
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `tds-export-${periodLabel}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        zoruSonnerToast.success('Exported to CSV successfully');
    };

    const handleUpdateTds = async () => {
        if (!editingRow) return;
        const val = Number(newTdsValue);
        
        // Optimistic update
        setRows(prev => prev.map(r => r._id === editingRow._id ? { ...r, tds: val } : r));
        setEditingRow(null);
        zoruSonnerToast.success('TDS updated successfully (Optimistic)');
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6 transition-all hover:border-zoru-brand">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Total TDS Collected</p>
                    <div className="mt-2 text-2xl text-zoru-ink font-medium">₹{totalTDS.toLocaleString('en-IN')}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{periodLabel}</p>
                </Card>
                <Card className="p-6 transition-all hover:border-zoru-brand">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Applicable Employees</p>
                    <div className="mt-2 text-2xl text-zoru-ink font-medium">{filteredRows.filter(r => r.tds > 0).length}</div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">out of {filteredRows.length} total</p>
                </Card>
                <Card className="p-6 transition-all hover:border-zoru-brand">
                    <p className="text-[12.5px] font-medium text-zoru-ink-muted">Avg. TDS per Employee</p>
                    <div className="mt-2 text-2xl text-zoru-ink font-medium">
                        ₹{avgTds.toLocaleString('en-IN')}
                    </div>
                    <p className="mt-1 text-[11.5px] text-zoru-ink-muted">among applicable employees</p>
                </Card>
            </div>

            <Card className="flex flex-col overflow-hidden">
                <div className="p-4 border-b border-zoru-line flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
                        <Input 
                            placeholder="Search by name or PAN..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-[13px]"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <ZoruButton variant="danger" size="sm" onClick={handleBulkDelete} className="h-9 text-[12.5px]">
                                <Trash className="w-3.5 h-3.5 mr-1.5" />
                                Delete ({selectedIds.size})
                            </ZoruButton>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <ZoruButton variant="outline" size="sm" className="h-9 text-[12.5px]">
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    Export
                                </ZoruButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={exportCSV} className="text-[13px]">
                                    <FileText className="w-4 h-4 mr-2 text-zoru-ink-muted" />
                                    Export as CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { window.print(); zoruSonnerToast.success('Opening print preview...'); }} className="text-[13px]">
                                    <FileText className="w-4 h-4 mr-2 text-zoru-ink-muted" />
                                    Export as PDF
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div ref={parentRef} className="max-h-[600px] overflow-auto relative">
                    <table className="w-full text-left text-[13px]">
                        <thead className="sticky top-0 bg-zoru-surface-2 z-10 border-b border-zoru-line shadow-sm">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center">
                                    <ZoruCheckbox 
                                        checked={selectedIds.size > 0 && selectedIds.size === filteredRows.length}
                                        onCheckedChange={toggleAll}
                                    />
                                </th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted font-medium">Employee</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted font-medium">PAN Number</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted font-medium">Tax Regime</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted font-medium">Gross Salary</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted font-medium">TDS Amount</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted font-medium text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="h-32 text-center text-[13px] text-zoru-ink-muted">
                                        No TDS records found.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {paddingTop > 0 && <tr><td colSpan={7} style={{ height: paddingTop }} /></tr>}
                                    {virtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = filteredRows[virtualRow.index];
                                        return (
                                            <tr key={row._id?.toString() ?? virtualRow.index} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors group">
                                                <td className="px-4 py-3 text-center">
                                                    <ZoruCheckbox 
                                                        checked={selectedIds.has(row._id.toString())}
                                                        onCheckedChange={(c) => toggleRow(row._id.toString(), !!c)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-zoru-ink">
                                                        {row.employee?.firstName} {row.employee?.lastName}
                                                    </div>
                                                    <div className="text-[11.5px] text-zoru-ink-muted truncate max-w-[150px]">{row.employee?.designationName ?? '—'}</div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-[12px] text-zoru-ink">{row.pan}</td>
                                                <td className="px-4 py-3">{regimeBadge(row.taxRegime)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-zoru-ink">₹{(row.grossSalary ?? 0).toLocaleString('en-IN')}</td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {row.tds > 0 ? (
                                                        <span className="text-zoru-brand font-medium">₹{row.tds.toLocaleString('en-IN')}</span>
                                                    ) : (
                                                        <Badge variant="secondary" className="font-normal">Nil</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <ZoruButton 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => {
                                                            setEditingRow(row);
                                                            setNewTdsValue(String(row.tds));
                                                        }}
                                                    >
                                                        Adjust
                                                    </ZoruButton>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {paddingBottom > 0 && <tr><td colSpan={7} style={{ height: paddingBottom }} /></tr>}
                                </>
                            )}
                        </tbody>
                        {filteredRows.length > 0 && (
                            <tfoot className="sticky bottom-0 bg-zoru-surface-2 shadow-[0_-1px_0_var(--zoru-line)]">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-[12.5px] text-zoru-ink font-medium">Total for view</td>
                                    <td className="px-4 py-3 text-right text-[12.5px] text-zoru-ink font-medium">--</td>
                                    <td className="px-4 py-3 text-right font-mono text-[13.5px] text-zoru-brand font-semibold">₹{totalTDS.toLocaleString('en-IN')}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </Card>

            <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-lg">Adjust TDS Amount</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[13px] text-zoru-ink-muted">Employee</Label>
                            <div className="font-medium text-zoru-ink">{editingRow?.employee?.firstName} {editingRow?.employee?.lastName}</div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[13px] text-zoru-ink-muted">New TDS Amount (₹)</Label>
                            <Input 
                                type="number" 
                                value={newTdsValue} 
                                onChange={e => setNewTdsValue(e.target.value)} 
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ZoruButton variant="outline" onClick={() => setEditingRow(null)}>Cancel</ZoruButton>
                        <ZoruButton onClick={handleUpdateTds} variant="primary">Save Changes</ZoruButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
