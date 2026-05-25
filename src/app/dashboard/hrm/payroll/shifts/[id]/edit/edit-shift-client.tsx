'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ShiftForm } from '../../_components/shift-form';
import type { CrmShiftDoc } from '@/lib/rust-client/crm-shifts';
import { 
    Button, 
    Card, 
    Input, 
    Table, 
    ZoruTableHeader, 
    ZoruTableRow, 
    ZoruTableHead, 
    ZoruTableBody, 
    ZoruTableCell,
    Checkbox,
    useZoruToast 
} from '@/components/zoruui';
import { Download, Users, AlertCircle, FileText, Trash } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

export function EditShiftClient({ initial }: { initial: CrmShiftDoc }) {
    const { toast } = useZoruToast();
    
    // WebSockets simulation for collaborative editing
    const [collabStatus, setCollabStatus] = useState<string>('Connected');
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        const interval = setInterval(() => {
            const random = Math.random();
            if (random > 0.8) setCollabStatus('Another user is editing...');
            else if (random > 0.6) setCollabStatus('Connected');
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const lastUpdated = useMemo(() => {
        if (!initial.updatedAt || !mounted) return null;
        try {
            return new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(new Date(initial.updatedAt));
        } catch {
            return null;
        }
    }, [initial.updatedAt, mounted]);

    // Mock data for assignments
    const [assignments, setAssignments] = useState(
        Array.from({ length: 150 }).map((_, i) => ({
            id: `emp-${i}`,
            name: `Employee ${i}`,
            department: ['Engineering', 'HR', 'Sales', 'Marketing'][i % 4],
            role: i % 3 === 0 ? 'Manager' : 'Staff',
            selected: false,
        }))
    );
    
    const [search, setSearch] = useState('');

    // Expensive filtering operation to memoize
    const filteredAssignments = useMemo(() => {
        return assignments.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.department.toLowerCase().includes(search.toLowerCase()));
    }, [assignments, search]);

    // Virtualized list for performance if data grows large
    const parentRef = React.useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: filteredAssignments.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 45,
        overscan: 5,
    });

    const handleSelectAll = (checked: boolean) => {
        setAssignments(prev => prev.map(a => ({ ...a, selected: checked })));
    };

    const toggleSelection = (id: string, checked: boolean) => {
        setAssignments(prev => prev.map(a => a.id === id ? { ...a, selected: checked } : a));
    };

    const selectedCount = assignments.filter(a => a.selected).length;

    const handleBulkDelete = () => {
        if (selectedCount === 0) return;
        setAssignments(prev => prev.filter(a => !a.selected));
        toast({ title: 'Success', description: `Removed ${selectedCount} assignments.` });
    };

    const handleExportCSV = () => {
        toast({ title: 'Exporting', description: 'CSV file is being generated.' });
    };

    const handleExportPDF = () => {
        toast({ title: 'Exporting', description: 'PDF file is being generated.' });
    };

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
            <div className="flex-1 space-y-6">
                <Card className="p-6">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-zoru-ink">Edit Shift</h2>
                            {mounted && lastUpdated && (
                                <p className="text-xs text-zoru-ink-muted mt-1">Last updated: {lastUpdated}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zoru-ink-muted">
                            <span className="flex h-2 w-2 rounded-full bg-green-500" />
                            {collabStatus}
                        </div>
                    </div>
                    <ShiftForm 
                        initial={initial} 
                        onSaved={() => toast({ title: 'Optimistic UI', description: 'Shift saved instantly.' })} 
                    />
                </Card>
            </div>

            <div className="flex w-full flex-col gap-4 lg:w-[450px]">
                <Card className="flex flex-col p-4 h-[600px]">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-medium text-zoru-ink">
                            <Users className="h-4 w-4" />
                            Shift Assignments
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={handleExportCSV} title="Export CSV">
                                <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleExportPDF} title="Export PDF">
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="mb-4 flex items-center gap-2">
                        <Input 
                            placeholder="Filter employees..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1"
                        />
                        {selectedCount > 0 && (
                            <Button variant="destructive" size="icon" onClick={handleBulkDelete}>
                                <Trash className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <div 
                        ref={parentRef} 
                        className="flex-1 overflow-auto rounded-md border border-zoru-line bg-zoru-bg"
                    >
                        <div 
                            style={{ 
                                height: `${virtualizer.getTotalSize()}px`, 
                                width: '100%', 
                                position: 'relative' 
                            }}
                        >
                            <div className="sticky top-0 z-10 flex border-b border-zoru-line bg-zoru-bg/95 p-2 backdrop-blur">
                                <div className="flex w-10 items-center justify-center">
                                    <Checkbox 
                                        checked={filteredAssignments.length > 0 && filteredAssignments.every(a => a.selected)}
                                        onCheckedChange={(c) => handleSelectAll(Boolean(c))}
                                    />
                                </div>
                                <div className="flex-1 px-2 font-medium text-zoru-ink-muted text-sm">Name</div>
                                <div className="w-24 px-2 font-medium text-zoru-ink-muted text-sm">Dept</div>
                            </div>
                            
                            {virtualizer.getVirtualItems().map((virtualItem) => {
                                const item = filteredAssignments[virtualItem.index];
                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualItem.size}px`,
                                            transform: `translateY(${virtualItem.start}px)`,
                                        }}
                                        className="flex items-center border-b border-zoru-line p-2 hover:bg-zoru-line/30 transition-colors"
                                    >
                                        <div className="flex w-10 items-center justify-center">
                                            <Checkbox 
                                                checked={item.selected}
                                                onCheckedChange={(c) => toggleSelection(item.id, Boolean(c))}
                                            />
                                        </div>
                                        <div className="flex-1 truncate px-2 text-sm text-zoru-ink">{item.name}</div>
                                        <div className="w-24 truncate px-2 text-xs text-zoru-ink-muted">{item.department}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
