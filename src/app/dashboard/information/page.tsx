'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Skeleton,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Separator,
  Button,
  Input,
  Checkbox,
  useZoruToast,
} from '@/components/zoruui';
import { getProjectById } from '@/app/actions/index';
import type { WithId } from 'mongodb';
import type { Project, PaymentConfiguration, BusinessCapabilities } from '@/lib/definitions';
import { AlertCircle, Banknote, Briefcase, Download, Plus, Search, Trash, Edit, Save, X, FileText } from 'lucide-react';

import React, { useEffect, useState, useTransition, useMemo, useCallback, useRef, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { fmtDate as formatDate } from '@/lib/utils';

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }
    componentDidCatch(error: any, errorInfo: any) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b py-3 gap-2">
            <dt className="text-zoru-ink-muted">{label}</dt>
            <dd className="font-semibold text-left sm:text-right">{value}</dd>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-2/3 mt-2" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <ZoruCardHeader>
                        <Skeleton className="h-6 w-1/4" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardHeader>
                        <Skeleton className="h-6 w-1/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}

// === Information Records Section (Enhancement: Virtualized, Suspense, Bulk Actions, Export) ===

type InfoRecord = { id: string; key: string; value: string; updatedAt: number };

function generateDummyRecords(): InfoRecord[] {
    const records: InfoRecord[] = [];
    for (let i = 1; i <= 500; i++) {
        records.push({
            id: `rec-${i}`,
            key: `Project Setting ${i}`,
            value: `Value associated with setting ${i}`,
            updatedAt: Date.now() - Math.floor(Math.random() * 10000000)
        });
    }
    return records;
}

let recordsCache: InfoRecord[] | null = null;
let recordsPromise: Promise<void> | null = null;

function fetchRecordsSuspense() {
    if (recordsCache !== null) return recordsCache;
    if (!recordsPromise) {
        recordsPromise = new Promise<void>(resolve => {
            setTimeout(() => {
                recordsCache = generateDummyRecords();
                resolve();
            }, 800); // simulate API loading
        });
    }
    throw recordsPromise;
}

function InfoRecordForm({
    initialData,
    onSubmit,
    onCancel
}: {
    initialData?: { key: string; value: string };
    onSubmit: (data: { key: string; value: string }) => Promise<void>;
    onCancel: () => void;
}) {
    const [key, setKey] = useState(initialData?.key || '');
    const [value, setValue] = useState(initialData?.value || '');
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            await onSubmit({ key, value });
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full items-start sm:items-center">
            <Input 
                placeholder="Key" 
                value={key} 
                onChange={e => setKey(e.target.value)} 
                required
                className="w-full sm:w-1/3"
            />
            <Input 
                placeholder="Value" 
                value={value} 
                onChange={e => setValue(e.target.value)} 
                required
                className="w-full sm:w-1/2"
            />
            <div className="flex gap-2 w-full sm:w-auto">
                <Button type="submit" disabled={isPending} size="sm">
                    {isPending ? 'Saving...' : <Save className="w-4 h-4" />}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isPending} size="sm">
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </form>
    );
}

function InformationRecordsSection() {
    const initialRecords = fetchRecordsSuspense();
    const { toast } = useZoruToast();
    const [records, setRecords] = useState<InfoRecord[]>(initialRecords);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // WebSocket mock for real-time collaborative editing updates
    useEffect(() => {
        const interval = setInterval(() => {
            setRecords(prev => {
                if (prev.length === 0) return prev;
                const randomIndex = Math.floor(Math.random() * Math.min(20, prev.length)); // Update top 20 for visibility
                const record = prev[randomIndex];
                const newRecords = [...prev];
                newRecords[randomIndex] = {
                    ...record,
                    value: record.value.includes('(Updated via WebSocket)') ? record.value.replace(' (Updated via WebSocket)', '') : record.value + ' (Updated via WebSocket)',
                    updatedAt: Date.now()
                };
                return newRecords;
            });
            toast({
                title: 'Real-time Update Received',
                description: 'A record was updated by a collaborator.',
                duration: 3000,
            });
        }, 20000); // every 20s
        return () => clearInterval(interval);
    }, [toast]);

    const filteredRecords = useMemo(() => {
        const lowerSearch = search.toLowerCase();
        return records.filter(r => 
            r.key.toLowerCase().includes(lowerSearch) || 
            r.value.toLowerCase().includes(lowerSearch)
        );
    }, [records, search]);

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredRecords.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60,
        overscan: 5,
    });

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        
        // Optimistic UI update
        const idsToDelete = new Set(selectedIds);
        setRecords(prev => prev.filter(r => !idsToDelete.has(r.id)));
        setSelectedIds(new Set());
        toast({ title: 'Success', description: `Deleted ${idsToDelete.size} records.` });
    };

    const handleAdd = async (data: { key: string; value: string }) => {
        return new Promise<void>(resolve => {
            setTimeout(() => {
                const newRecord = {
                    id: `rec-new-${Date.now()}`,
                    key: data.key,
                    value: data.value,
                    updatedAt: Date.now()
                };
                setRecords(prev => [newRecord, ...prev]);
                setIsAdding(false);
                toast({ title: 'Record added successfully' });
                resolve();
            }, 500); // simulate network
        });
    };

    const handleEdit = async (id: string, data: { key: string; value: string }) => {
        return new Promise<void>(resolve => {
            setTimeout(() => {
                setRecords(prev => prev.map(r => r.id === id ? { ...r, ...data, updatedAt: Date.now() } : r));
                setEditingId(null);
                toast({ title: 'Record updated successfully' });
                resolve();
            }, 500);
        });
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredRecords.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
        }
    };

    const exportCSV = () => {
        const header = "Key,Value,Last Updated\n";
        const csv = filteredRecords.map(r => `"${r.key.replace(/"/g, '""')}","${r.value.replace(/"/g, '""')}","${formatDate(r.updatedAt)}"`).join("\n");
        const blob = new Blob([header + csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'information_export.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        autoTable(doc, {
            head: [['Key', 'Value', 'Last Updated']],
            body: filteredRecords.map(r => [r.key, r.value, formatDate(r.updatedAt)]),
        });
        doc.save("information_export.pdf");
    };

    return (
        <Card className="flex flex-col h-[600px]">
            <ZoruCardHeader className="shrink-0 border-b pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <ZoruCardTitle>Additional Information</ZoruCardTitle>
                        <ZoruCardDescription>Manage key-value metadata for this project. Showing {filteredRecords.length} records.</ZoruCardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={exportCSV} title="Export CSV"><Download className="w-4 h-4 mr-1" /> CSV</Button>
                        <Button variant="outline" size="sm" onClick={exportPDF} title="Export PDF"><FileText className="w-4 h-4 mr-1" /> PDF</Button>
                        <Button size="sm" onClick={() => setIsAdding(true)}><Plus className="w-4 h-4 mr-1" /> Add New</Button>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-4 items-center justify-between">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                        <Input 
                            placeholder="Filter records..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-zoru-ink-muted">{selectedIds.size} selected</span>
                            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                                <Trash className="w-4 h-4 mr-1" /> Delete Selected
                            </Button>
                        </div>
                    )}
                </div>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-1 overflow-hidden p-0 relative">
                {/* Header row */}
                <div className="flex items-center border-b bg-zoru-surface-2/50 p-3 sticky top-0 z-10 text-sm font-medium">
                    <div className="w-[50px] flex justify-center">
                        <Checkbox 
                            checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length} 
                            onCheckedChange={toggleSelectAll} 
                            aria-label="Select all"
                        />
                    </div>
                    <div className="flex-1">Key</div>
                    <div className="flex-1">Value</div>
                    <div className="w-[150px] hidden sm:block">Last Updated</div>
                    <div className="w-[100px] text-right">Actions</div>
                </div>
                
                {isAdding && (
                    <div className="p-3 border-b bg-zoru-surface-2/20">
                        <InfoRecordForm 
                            onSubmit={handleAdd} 
                            onCancel={() => setIsAdding(false)} 
                        />
                    </div>
                )}

                <div ref={parentRef} className="h-full overflow-auto p-2" style={{ height: 'calc(100% - 45px)' }}>
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const record = filteredRecords[virtualRow.index];
                            const isSelected = selectedIds.has(record.id);
                            const isEditing = editingId === record.id;

                            return (
                                <div
                                    key={record.id}
                                    className="absolute top-0 left-0 w-full flex items-center border-b p-2 group hover:bg-zoru-surface-2/30 transition-colors"
                                    style={{
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div className="w-[50px] flex justify-center shrink-0">
                                        <Checkbox 
                                            checked={isSelected} 
                                            onCheckedChange={() => toggleSelect(record.id)} 
                                            aria-label={`Select ${record.key}`}
                                        />
                                    </div>
                                    
                                    {isEditing ? (
                                        <div className="flex-1 px-2">
                                            <InfoRecordForm 
                                                initialData={record}
                                                onSubmit={(data) => handleEdit(record.id, data)}
                                                onCancel={() => setEditingId(null)}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 px-2 font-medium truncate" title={record.key}>{record.key}</div>
                                            <div className="flex-1 px-2 text-zoru-ink-muted truncate" title={record.value}>{record.value}</div>
                                            <div className="w-[150px] px-2 text-xs text-zoru-ink-muted hidden sm:block shrink-0">
                                                {formatDate(record.updatedAt)}
                                            </div>
                                            <div className="w-[100px] flex justify-end gap-1 px-2 shrink-0">
                                                <Button variant="ghost" size="icon" onClick={() => setEditingId(record.id)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </ZoruCardContent>
        </Card>
    );
}

export default function ProjectInformationPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);
    const { toast } = useZoruToast();

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient) {
            document.title = "Project Information | Wachat";
            const storedProjectId = localStorage.getItem('activeProjectId');
            if (storedProjectId) {
                getProjectById(storedProjectId).then(data => {
                    setProject(data);
                }).catch(err => {
                    toast({
                        variant: 'destructive',
                        title: 'Error Fetching Project',
                        description: 'Failed to load project details.',
                    });
                }).finally(() => {
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        }
    }, [isClient, toast]);

    const getReviewStatusVariant = (status?: string) => {
        if (!status) return 'outline';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'approved' || lowerStatus === 'verified') return 'default';
        if (lowerStatus.includes('pending') || lowerStatus.includes('unknown')) return 'secondary';
        return 'destructive';
    };

    if (!isClient || loading) {
        return <LoadingSkeleton />;
    }

    if (!project) {
        return (
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Project Information</h1>
                    <p className="text-zoru-ink-muted">General and technical details about your project.</p>
                </div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>No Project Selected</ZoruAlertTitle>
                    <ZoruAlertDescription>
                        Please select a project from the main dashboard page to see its information.
                    </ZoruAlertDescription>
                </Alert>
            </div>
        );
    }

    const paymentConfig: PaymentConfiguration | undefined = project.paymentConfiguration;
    const businessCaps: BusinessCapabilities | undefined = project.businessCapabilities;

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Project Information</h1>
                <p className="text-zoru-ink-muted">General and technical details for "{project.name}".</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5" />
                            General Details
                        </ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <dl className="space-y-1">
                            <InfoRow label="Project Name" value={project.name} />
                            <InfoRow label="WABA ID" value={<span className="font-mono text-sm break-all">{project.wabaId}</span>} />
                            <InfoRow label="Project ID" value={<span className="font-mono text-sm break-all">{project._id.toString()}</span>} />
                            <InfoRow label="Created At" value={formatDate(project.createdAt as any)} />
                            <InfoRow label="Account Review" value={
                                <Badge variant={getReviewStatusVariant(project.reviewStatus)} className="capitalize">
                                    {project.reviewStatus?.replace(/_/g, ' ') || 'Unknown'}
                                </Badge>
                            } />
                            {businessCaps && (
                                <>
                                    <div className="pt-2" />
                                    <Separator />
                                    <div className="pt-2" />
                                    <InfoRow label="Daily Conversation Limit" value={businessCaps.max_daily_conversation_per_phone?.toLocaleString() ?? 'N/A'} />
                                    <InfoRow label="Phone Number Limit" value={businessCaps.max_phone_numbers_per_business?.toLocaleString() ?? 'N/A'} />
                                </>
                            )}
                        </dl>
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5" />
                            Payment Configuration
                        </ZoruCardTitle>
                        <ZoruCardDescription>Details for payment integrations received via webhook.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {paymentConfig ? (
                            <dl className="space-y-1">
                                <InfoRow label="Provider Name" value={<span className="capitalize">{paymentConfig.provider_name}</span>} />
                                <InfoRow label="Configuration Name" value={paymentConfig.configuration_name} />
                                <InfoRow label="Provider MID" value={<span className="font-mono text-sm break-all">{paymentConfig.provider_mid}</span>} />
                                <InfoRow label="Status" value={<Badge variant={paymentConfig.status === 'Needs_Testing' ? 'secondary' : 'default'}>{paymentConfig.status}</Badge>} />
                                <InfoRow label="Last Updated" value={formatDate(paymentConfig.updated_timestamp * 1000)} />
                            </dl>
                        ) : (
                            <div className="text-center text-zoru-ink-muted py-8">
                                <p>No payment configuration data received for this project yet.</p>
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>
            </div>

            <ErrorBoundary fallback={
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>Error Loading Information</ZoruAlertTitle>
                    <ZoruAlertDescription>There was a problem loading the project metadata records.</ZoruAlertDescription>
                </Alert>
            }>
                <Suspense fallback={
                    <Card className="p-8 flex justify-center items-center h-[600px]">
                        <div className="flex flex-col items-center gap-4">
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-64 w-full mt-4" />
                        </div>
                    </Card>
                }>
                    <InformationRecordsSection />
                </Suspense>
            </ErrorBoundary>
        </div>
    );
}
