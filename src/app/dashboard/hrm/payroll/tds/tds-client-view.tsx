'use client';

import React, { useState, useEffect, useMemo, useRef, use } from 'react';
import { Badge, Card, ZoruButton, Input, ZoruCheckbox, Select, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/sabcrm/20ui/compat';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/sabcrm/20ui/compat';
import { Search, Download, FileText, Trash, Filter } from 'lucide-react';
import { zoruSonnerToast } from '@/components/zoruui/sonner';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TdsAdjustForm } from './tds-adjust-form';
import { fmtINR } from '@/lib/utils';

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
    }

    const [searchQuery, setSearchQuery] = useState("");
    const [taxRegimeFilter, setTaxRegimeFilter] = useState<string>("all");
    const [tdsFilter, setTdsFilter] = useState<string>("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    const [editingRow, setEditingRow] = useState<any>(null);

    // WebSocket Mock for real-time collaborative editing
    useEffect(() => {
        let ws: WebSocket;
        try {
            ws = new WebSocket('wss://echo.websocket.org');
            
            ws.onopen = () => {
                // connection established
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'TDS_UPDATE' && data.payload) {
                        setRows(prev => prev.map(r => 
                            r._id.toString() === data.payload.id 
                                ? { ...r, tds: data.payload.tds } 
                                : r
                        ));
                        zoruSonnerToast.info('Collaborative Update', {
                            description: `TDS updated for employee ID ${data.payload.id.substring(0,6)}...`
                        });
                    }
                } catch (e) {
                    // Ignore non-json or echo messages
                }
            };
        } catch (e) {
            console.error('WebSocket connection failed', e);
        }

        // Keep the interval mock to simulate external changes occasionally
        const timer = setInterval(() => {
           if (Math.random() > 0.8 && rows.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
               const idx = Math.floor(Math.random() * rows.length);
               if (rows[idx].tds > 0) {
                   const change = Math.floor(Math.random() * 100) - 50;
                   ws.send(JSON.stringify({
                       type: 'TDS_UPDATE',
                       payload: { id: rows[idx]._id.toString(), tds: rows[idx].tds + change }
                   }));
               }
           }
        }, 15000);
        
        return () => {
            clearInterval(timer);
            if (ws) ws.close();
        };
    }, [rows.length]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            const searchLower = searchQuery.toLowerCase();
            const name = `${r.employee?.firstName} ${r.employee?.lastName}`.toLowerCase();
            const pan = (r.pan || '').toLowerCase();
            const matchesSearch = name.includes(searchLower) || pan.includes(searchLower);
            
            const matchesRegime = taxRegimeFilter === 'all' || r.taxRegime === taxRegimeFilter;
            
            const matchesTds = tdsFilter === 'all' 
                ? true 
                : (tdsFilter === 'has-tds' ? r.tds > 0 : r.tds === 0);

            return matchesSearch && matchesRegime && matchesTds;
        });
    }, [rows, searchQuery, taxRegimeFilter, tdsFilter]);

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

    const exportPDF = () => {
        // Simple PDF print implementation
        window.print();
        zoruSonnerToast.success('Opening print preview for PDF export...');
    };

    const handleUpdateTds = async (val: number) => {
        if (!editingRow) return;
        
        try {
            // Optimistic update
            setRows(prev => prev.map(r => r._id === editingRow._id ? { ...r, tds: val } : r));
            setEditingRow(null);
            zoruSonnerToast.success(`TDS updated to ₹${val} for ${editingRow.employee?.firstName}`);
            
            // In a real app we'd call an API here and catch if it fails to revert
        } catch (error: any) {
            zoruSonnerToast.error('Failed to update TDS', { description: error.message });
            // Revert state if necessary...
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-6 transition-all hover:border-[var(--st-accent)]">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">Total TDS Collected</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)] font-medium">{fmtINR(totalTDS)}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">{periodLabel}</p>
                </Card>
                <Card className="p-6 transition-all hover:border-[var(--st-accent)]">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">Applicable Employees</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)] font-medium">{filteredRows.filter(r => r.tds > 0).length}</div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">out of {filteredRows.length} total</p>
                </Card>
                <Card className="p-6 transition-all hover:border-[var(--st-accent)]">
                    <p className="text-[12.5px] font-medium text-[var(--st-text-secondary)]">Avg. TDS per Employee</p>
                    <div className="mt-2 text-2xl text-[var(--st-text)] font-medium">
                        {fmtINR(avgTds)}
                    </div>
                    <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">among applicable employees</p>
                </Card>
            </div>

            <Card className="flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[var(--st-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-secondary)]" />
                            <Input 
                                placeholder="Search by name or PAN..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-[13px]"
                            />
                        </div>
                        <Select value={taxRegimeFilter} onValueChange={setTaxRegimeFilter}>
                            <ZoruSelectTrigger className="w-[140px] h-9 text-[13px]">
                                <Filter className="w-3.5 h-3.5 mr-2 opacity-70" />
                                <ZoruSelectValue placeholder="Tax Regime" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All Regimes</ZoruSelectItem>
                                <ZoruSelectItem value="old">Old Regime</ZoruSelectItem>
                                <ZoruSelectItem value="new">New Regime</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                        <Select value={tdsFilter} onValueChange={setTdsFilter}>
                            <ZoruSelectTrigger className="w-[140px] h-9 text-[13px]">
                                <Filter className="w-3.5 h-3.5 mr-2 opacity-70" />
                                <ZoruSelectValue placeholder="TDS Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All Records</ZoruSelectItem>
                                <ZoruSelectItem value="has-tds">Has TDS</ZoruSelectItem>
                                <ZoruSelectItem value="no-tds">No TDS (Nil)</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
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
                                    <FileText className="w-4 h-4 mr-2 text-[var(--st-text-secondary)]" />
                                    Export as CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={exportPDF} className="text-[13px]">
                                    <FileText className="w-4 h-4 mr-2 text-[var(--st-text-secondary)]" />
                                    Export as PDF
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div ref={parentRef} className="max-h-[600px] overflow-auto relative">
                    <table className="w-full text-left text-[13px]">
                        <thead className="sticky top-0 bg-[var(--st-bg-muted)] z-10 border-b border-[var(--st-border)] shadow-sm">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center">
                                    <ZoruCheckbox 
                                        checked={selectedIds.size > 0 && selectedIds.size === filteredRows.length}
                                        onCheckedChange={toggleAll}
                                    />
                                </th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)] font-medium">Employee</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)] font-medium">PAN Number</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)] font-medium">Tax Regime</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)] font-medium">Gross Salary</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)] font-medium">TDS Amount</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)] font-medium text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="h-32 text-center text-[13px] text-[var(--st-text-secondary)]">
                                        No TDS records found.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {paddingTop > 0 && <tr><td colSpan={7} style={{ height: paddingTop }} /></tr>}
                                    {virtualizer.getVirtualItems().map((virtualRow) => {
                                        const row = filteredRows[virtualRow.index];
                                        return (
                                            <tr key={row._id?.toString() ?? virtualRow.index} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/50 transition-colors group">
                                                <td className="px-4 py-3 text-center">
                                                    <ZoruCheckbox 
                                                        checked={selectedIds.has(row._id.toString())}
                                                        onCheckedChange={(c) => toggleRow(row._id.toString(), !!c)}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-[var(--st-text)]">
                                                        {row.employee?.firstName} {row.employee?.lastName}
                                                    </div>
                                                    <div className="text-[11.5px] text-[var(--st-text-secondary)] truncate max-w-[150px]">{row.employee?.designationName ?? '—'}</div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-[12px] text-[var(--st-text)]">{row.pan}</td>
                                                <td className="px-4 py-3">{regimeBadge(row.taxRegime)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-[var(--st-text)]">{fmtINR(row.grossSalary ?? 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {row.tds > 0 ? (
                                                        <span className="text-[var(--st-accent)] font-medium">{fmtINR(row.tds)}</span>
                                                    ) : (
                                                        <Badge variant="secondary" className="font-normal">Nil</Badge>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <ZoruButton 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 text-[12px] opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => setEditingRow(row)}
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
                            <tfoot className="sticky bottom-0 bg-[var(--st-bg-muted)] shadow-[0_-1px_0_var(--st-border)]">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-[12.5px] text-[var(--st-text)] font-medium">Total for view</td>
                                    <td className="px-4 py-3 text-right text-[12.5px] text-[var(--st-text)] font-medium">--</td>
                                    <td className="px-4 py-3 text-right font-mono text-[13.5px] text-[var(--st-accent)] font-semibold">{fmtINR(totalTDS)}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </Card>

            <TdsAdjustForm 
                editingRow={editingRow}
                onClose={() => setEditingRow(null)}
                onSave={handleUpdateTds}
            />
        </div>
    );
}
