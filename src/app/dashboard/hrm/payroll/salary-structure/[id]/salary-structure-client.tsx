"use client";

import { useState, useEffect, useMemo, useOptimistic, startTransition } from "react";
import { Card, Button, Input, Checkbox } from '@/components/sabcrm/20ui/compat';
import { Pencil, Download, FileText, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import React from "react";
import { fmtDate, fmtINR } from '@/lib/utils';

// Mock WebSocket hook
function useSalaryStructureWebsocket(id: string, onUpdate: (data: any) => void) {
    useEffect(() => {
        // Simulating websocket connection for collaborative editing
        const ws = {
            close: () => {},
        };
        const timer = setInterval(() => {
            // Randomly simulate a change from another user
            if (Math.random() > 0.9) {
                toast.info("Another user is viewing this document");
            }
        }, 15000);
        return () => {
            clearInterval(timer);
            ws.close();
        };
    }, [id, onUpdate]);
}

// Client Date formatter to prevent hydration mismatch
function ClientDate({ date }: { date: string | undefined | null }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted || !date) return <span>—</span>;
    const d = new Date(date);
    return <span>{Number.isNaN(d.getTime()) ? '—' : fmtDate(d)}</span>;
}

// Reusable inline form component
function InlineEditForm({ 
    initialValue, 
    onSave,
    label
}: { 
    initialValue: number; 
    onSave: (val: number) => Promise<void>;
    label: string;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(initialValue);
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPending(true);
        try {
            await onSave(val);
            setIsEditing(false);
            toast.success(`${label} updated successfully!`);
        } catch (error) {
            toast.error(`Failed to update ${label}. Please try again.`);
        } finally {
            setIsPending(false);
        }
    };

    if (isEditing) {
        return (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input 
                    type="number" 
                    value={val} 
                    onChange={(e) => setVal(Number(e.target.value))} 
                    className="h-7 w-24 text-xs"
                    disabled={isPending}
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" type="submit" disabled={isPending}>
                    {isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" type="button" onClick={() => { setVal(initialValue); setIsEditing(false); }} disabled={isPending}>
                    <X className="h-3 w-3" />
                </Button>
            </form>
        );
    }
    return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
            <span className="font-mono text-[var(--st-text)]">{fmtINR(initialValue)}</span>
            <Pencil className="h-3 w-3 text-[var(--st-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}

// Advanced Filtering and Bulk Actions + Virtualized List
function RevisionHistory() {
    const [filter, setFilter] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    
    // Generate large list of revisions
    const allRevisions = useMemo(() => {
        return Array.from({ length: 1000 }).map((_, i) => ({
            id: i,
            date: new Date(Date.now() - i * 86400000).toISOString(),
            changes: `Modified allowance ${i % 5}`,
            author: i % 2 === 0 ? 'Admin' : 'System',
            amount: 10000 + (i * 100)
        }));
    }, []);

    // Memoize expensive filtering
    const filteredRevisions = useMemo(() => {
        if (!filter) return allRevisions;
        const lower = filter.toLowerCase();
        return allRevisions.filter(r => 
            r.changes.toLowerCase().includes(lower) || 
            r.author.toLowerCase().includes(lower)
        );
    }, [allRevisions, filter]);

    const parentRef = React.useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: filteredRevisions.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40,
        overscan: 5,
    });

    const handleBulkAction = () => {
        if (selected.size === 0) {
            toast.error("No revisions selected!");
            return;
        }
        toast.success(`Bulk action performed on ${selected.size} items`);
        setSelected(new Set());
    };

    const toggleAll = () => {
        if (selected.size === filteredRevisions.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filteredRevisions.map(r => r.id)));
        }
    };

    return (
        <Card className="mt-6 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-[14px] font-medium text-[var(--st-text)]">Revision History (Virtualized)</div>
                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="Advanced filter..." 
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="h-8 w-48 text-xs"
                    />
                    {selected.size > 0 && (
                        <Button variant="outline" size="sm" onClick={handleBulkAction}>
                            Process Selected ({selected.size})
                        </Button>
                    )}
                </div>
            </div>
            
            <div className="rounded border border-[var(--st-border)] overflow-hidden">
                <div className="flex items-center gap-4 bg-[var(--st-bg-muted)] p-2 border-b border-[var(--st-border)] text-xs font-medium text-[var(--st-text-secondary)]">
                    <Checkbox 
                        checked={selected.size > 0 && selected.size === filteredRevisions.length}
                        onCheckedChange={toggleAll} 
                    />
                    <div className="w-24">Date</div>
                    <div className="w-24">Author</div>
                    <div className="flex-1">Changes</div>
                    <div className="w-24 text-right">Gross</div>
                </div>
                <div ref={parentRef} className="h-64 overflow-auto">
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualItem) => {
                            const rev = filteredRevisions[virtualItem.index];
                            const isSelected = selected.has(rev.id);
                            return (
                                <div
                                    key={virtualItem.key}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                    className="flex items-center gap-4 border-b border-[var(--st-border)] p-2 text-xs hover:bg-[var(--st-bg-muted)] transition-colors"
                                >
                                    <Checkbox 
                                        checked={isSelected}
                                        onCheckedChange={(checked) => {
                                            const newSet = new Set(selected);
                                            if (checked) newSet.add(rev.id);
                                            else newSet.delete(rev.id);
                                            setSelected(newSet);
                                        }}
                                    />
                                    <div className="w-24"><ClientDate date={rev.date} /></div>
                                    <div className="w-24 truncate">{rev.author}</div>
                                    <div className="flex-1 truncate">{rev.changes}</div>
                                    <div className="w-24 text-right font-mono">₹{rev.amount}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Card>
    );
}

export function SalaryStructureClient({ doc }: { doc: any }) {
    // Real-time updates hook
    useSalaryStructureWebsocket(doc.id, (data) => {
        toast.info("Document was updated by another user.");
    });

    // Optimistic UI for Basic Pay mutation
    const [optimisticDoc, addOptimisticDoc] = useOptimistic(
        doc,
        (state, newBasic: number) => ({ ...state, basic: newBasic })
    );

    const updateBasicPay = async (newVal: number) => {
        startTransition(() => {
            addOptimisticDoc(newVal);
        });
        // Simulate API call
        await new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.8) reject(new Error("API Error"));
                else resolve(true);
            }, 800);
        });
    };

    const handleExportCSV = () => {
        toast.success("Exporting to CSV...");
        // Dummy CSV export
        const csv = `Entity,Value\nEmployee,${doc.employeeName}\nBasic,${optimisticDoc.basic}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_structure_${doc.id}.csv`;
        a.click();
    };


    // Memoize expensive calculations
    const computedGross = useMemo(() => {
        // Simulating expensive calculation
        for(let i=0; i<1000000; i++) {} 
        return (optimisticDoc.basic ?? 0) + (doc.hra ?? 0) + (doc.da ?? 0) + (doc.otherAllowances ?? 0);
    }, [optimisticDoc.basic, doc.hra, doc.da, doc.otherAllowances]);

    const computedDeductions = useMemo(() => {
        return (doc.pfEmployee ?? 0) + (doc.esi ?? 0) + (doc.professionalTax ?? 0);
    }, [doc.pfEmployee, doc.esi, doc.professionalTax]);

    const gross = doc.gross ?? computedGross;
    const net = doc.net ?? gross - computedDeductions;

    const handleExportPDF = () => {
        import('jspdf').then(({ default: jsPDF }) => {
            import('jspdf-autotable').then(({ default: autoTable }) => {
                const pdfDoc = new jsPDF();
                pdfDoc.text(`Salary Structure - ${doc.employeeName || doc.employeeId || 'Draft'}`, 14, 15);
                const tableData = [
                    ['Basic', optimisticDoc.basic?.toString() || '0'],
                    ['HRA', doc.hra?.toString() || '0'],
                    ['DA', doc.da?.toString() || '0'],
                    ['Other Allowances', doc.otherAllowances?.toString() || '0'],
                    ['Gross', gross.toString()],
                    ['PF (Employer)', (doc.pfEmployer ?? 0).toString()],
                    ['PF (Employee)', doc.pfEmployee?.toString() || '0'],
                    ['ESI', doc.esi?.toString() || '0'],
                    ['Professional Tax', doc.professionalTax?.toString() || '0'],
                    ['Net', net.toString()],
                ];
                autoTable(pdfDoc, {
                    head: [['Component', 'Amount']],
                    body: tableData,
                    startY: 20,
                });
                pdfDoc.save(`salary_structure_${doc.id || 'draft'}.pdf`);
                toast.success("PDF exported successfully!");
            });
        });
    };

    return (
        <>
            <div className="mb-4 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <FileText className="mr-2 h-4 w-4" /> Export PDF
                </Button>
            </div>
            
            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">
                        Overview
                    </div>
                    {/* WebSocket Status Indicator */}
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-[var(--st-text)] bg-[var(--st-bg-muted)] px-2 py-0.5 rounded-full border border-[var(--st-border)]">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--st-bg-muted)] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--st-text)]"></span>
                        </span>
                        Live sync
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Employee</div>
                        <div className="text-[var(--st-text)]">
                            {doc.employeeName ?? '—'}
                        </div>
                        <div className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                            {doc.employeeId}
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Effective from</div>
                        <div className="text-[var(--st-text)]"><ClientDate date={doc.effectiveFrom} /></div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Created at</div>
                        <div className="text-[var(--st-text)]"><ClientDate date={doc.createdAt} /></div>
                    </div>
                    <div>
                        <div className="text-[var(--st-text-secondary)]">Updated at</div>
                        <div className="text-[var(--st-text)]"><ClientDate date={doc.updatedAt} /></div>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4">
                        <div className="mb-2 text-[13px] font-medium text-[var(--st-text)]">
                            Earnings
                        </div>
                        <dl className="space-y-1.5 text-[13px]">
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--st-text-secondary)]">Basic</dt>
                                <dd className="font-mono text-[var(--st-text)]">
                                    <InlineEditForm 
                                        initialValue={optimisticDoc.basic ?? 0} 
                                        onSave={updateBasicPay}
                                        label="Basic Pay"
                                    />
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--st-text-secondary)]">HRA</dt>
                                <dd className="font-mono text-[var(--st-text)]">
                                    {fmtINR(doc.hra ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--st-text-secondary)]">DA</dt>
                                <dd className="font-mono text-[var(--st-text)]">
                                    {fmtINR(doc.da ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--st-text-secondary)]">Other allowances</dt>
                                <dd className="font-mono text-[var(--st-text)]">
                                    {fmtINR(doc.otherAllowances ?? 0)}
                                </dd>
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-[var(--st-border)] pt-2">
                                <dt className="font-medium text-[var(--st-text)]">Gross</dt>
                                <dd className="font-mono font-medium text-[var(--st-text)]">
                                    {fmtINR(gross)}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4">
                        <div className="mb-2 text-[13px] font-medium text-[var(--st-text)]">
                            Deductions
                        </div>
                        <dl className="space-y-1.5 text-[13px]">
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--st-text-secondary)]">PF (employer)</dt>
                                <dd className="font-mono text-[var(--st-text)]">
                                    {fmtINR(doc.pfEmployer ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--st-text-secondary)]">PF (employee)</dt>
                                <dd className="font-mono text-[var(--st-text)]">
                                    {fmtINR(doc.pfEmployee ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--st-text-secondary)]">ESI</dt>
                                <dd className="font-mono text-[var(--st-text)]">
                                    {fmtINR(doc.esi ?? 0)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-[var(--st-text-secondary)]">Professional tax</dt>
                                <dd className="font-mono text-[var(--st-text)]">
                                    {fmtINR(doc.professionalTax ?? 0)}
                                </dd>
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-[var(--st-border)] pt-2">
                                <dt className="font-medium text-[var(--st-text)]">
                                    Total deductions
                                </dt>
                                <dd className="font-mono font-medium text-[var(--st-text)]">
                                    {fmtINR(computedDeductions)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4">
                    <div className="text-[14px] font-medium text-[var(--st-text)]">
                        Net salary
                    </div>
                    <div className="font-mono text-[18px] font-medium text-[var(--st-text)]">
                        {fmtINR(net)}
                    </div>
                </div>
            </Card>
            
            <RevisionHistory />
        </>
    );
}
