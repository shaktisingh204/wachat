'use client';

import * as React from 'react';
import {
    Folder,
    FileUp,
    LoaderCircle,
    Plus,
    Trash2,
    Search,
    FileText,
    X,
    ExternalLink,
    FolderOpen,
} from 'lucide-react';
import { Button, Card, Checkbox, Input, Label, Textarea, useToast, Table, THead, TBody, Tr, Td, Th } from '@/components/sabcrm/20ui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { EnumFormField } from '@/components/crm/enum-form-field';

import {
    deleteDocument,
    saveDocument,
    getDocuments,
    type DocumentKpis,
} from '@/app/actions/crm-documents.actions';
import type {
    CrmDocumentDoc,
    CrmDocumentCategory,
    CrmDocumentStatus,
} from '@/lib/rust-client/crm-documents';

interface DocumentsListClientProps {
    initialDocuments: CrmDocumentDoc[];
    initialKpis: DocumentKpis;
}

const CATEGORIES: { value: CrmDocumentCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All Folders' },
    { value: 'id_proof', label: 'ID Proofs' },
    { value: 'address_proof', label: 'Address Proofs' },
    { value: 'qualification', label: 'Qualifications' },
    { value: 'experience', label: 'Experience' },
    { value: 'contract', label: 'Contracts' },
    { value: 'appointment', label: 'Appointments' },
    { value: 'resignation', label: 'Resignations' },
    { value: 'other', label: 'Others' },
];

const STATUS_TONE: Record<CrmDocumentStatus, StatusTone> = {
    pending: 'amber',
    verified: 'green',
    expired: 'red',
    rejected: 'red',
    archived: 'neutral',
};

export function DocumentsListClient({
    initialDocuments,
    initialKpis: _initialKpis,
}: DocumentsListClientProps) {
    const { toast } = useToast();
    const [documents, setDocuments] = React.useState<CrmDocumentDoc[]>(initialDocuments);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isMutating, startMutate] = React.useTransition();

    // Filters
    const [searchQuery, setSearchQuery] = React.useState('');
    const [activeCategory, setActiveCategory] = React.useState<CrmDocumentCategory | 'all'>('all');

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingDoc, setEditingDoc] = React.useState<CrmDocumentDoc | null>(null);

    // Form fields
    const [docName, setDocName] = React.useState('');
    const [category, setCategory] = React.useState<CrmDocumentCategory>('other');
    const [docNumber, setDocNumber] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [fileUrl, setFileUrl] = React.useState('');
    const [fileName, setFileName] = React.useState('');
    const [fileMime, setFileMime] = React.useState('');
    const [fileSize, setFileSize] = React.useState('');
    const [entityKind, setEntityKind] = React.useState('employee');
    const [entityId, setEntityId] = React.useState('');
    const [employeeName, setEmployeeName] = React.useState('');
    const [issueDate, setIssueDate] = React.useState('');
    const [expiryDate, setExpiryDate] = React.useState('');
    const [tags, setTags] = React.useState('');
    const [status, setStatus] = React.useState<CrmDocumentStatus>('pending');
    const [notes, setNotes] = React.useState('');
    const [isConfidential, setIsConfidential] = React.useState(false);

    const refreshData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getDocuments({
                q: searchQuery.trim() || undefined,
                category: activeCategory === 'all' ? undefined : activeCategory,
                limit: 200,
            });
            setDocuments(res.items ?? []);
        } catch {
            setDocuments([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, activeCategory]);

    React.useEffect(() => {
        const t = setTimeout(() => {
            void refreshData();
        }, 200);
        return () => clearTimeout(t);
    }, [refreshData]);

    const openNew = () => {
        setEditingDoc(null);
        setDocName('');
        setCategory(activeCategory === 'all' ? 'other' : activeCategory);
        setDocNumber('');
        setDescription('');
        setFileUrl('');
        setFileName('');
        setFileMime('');
        setFileSize('');
        setEntityKind('employee');
        setEntityId('');
        setEmployeeName('');
        setIssueDate('');
        setExpiryDate('');
        setTags('');
        setStatus('pending');
        setNotes('');
        setIsConfidential(false);
        setIsDialogOpen(true);
    };

    const openEdit = (d: CrmDocumentDoc) => {
        setEditingDoc(d);
        setDocName(d.name);
        setCategory(d.category ?? 'other');
        setDocNumber(d.documentNumber ?? '');
        setDescription(d.description ?? '');
        setFileUrl(d.fileUrl ?? '');
        setFileName(d.fileUrl ? d.fileUrl.split('/').pop() || 'file' : '');
        setFileMime(d.mimeType ?? '');
        setFileSize(d.fileSize != null ? String(d.fileSize) : '');
        setEntityKind(d.entityKind ?? 'employee');
        setEntityId(d.entityId ?? '');
        setEmployeeName(d.employeeName ?? '');
        setIssueDate(d.issueDate ? d.issueDate.slice(0, 10) : '');
        setExpiryDate(d.expiryDate ? d.expiryDate.slice(0, 10) : '');
        setTags(Array.isArray(d.tags) ? d.tags.join(', ') : '');
        setStatus((d.status as CrmDocumentStatus) ?? 'pending');
        setNotes(d.notes ?? '');
        setIsConfidential(!!d.isConfidential);
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!docName.trim()) {
            toast({ title: 'Validation Error', description: 'Document name is required.', variant: 'destructive' });
            return;
        }

        const fd = new FormData();
        if (editingDoc) fd.append('documentId', editingDoc._id);
        fd.append('name', docName.trim());
        fd.append('category', category);
        fd.append('documentNumber', docNumber);
        fd.append('description', description);
        fd.append('fileUrl', fileUrl);
        fd.append('mimeType', fileMime);
        fd.append('fileSize', fileSize);
        fd.append('entityKind', entityKind);
        fd.append('entityId', entityId);
        fd.append('employeeName', employeeName);
        if (issueDate) fd.append('issueDate', issueDate);
        if (expiryDate) fd.append('expiryDate', expiryDate);
        fd.append('tags', tags);
        fd.append('status', status);
        fd.append('notes', notes);
        fd.append('isConfidential', isConfidential ? 'true' : 'false');

        startMutate(async () => {
            const res = await saveDocument(undefined, fd);
            if (res.error) {
                toast({ title: 'Failed to save', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Document Saved', description: res.message || 'Saved successfully.' });
                setIsDialogOpen(false);
                void refreshData();
            }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        startMutate(async () => {
            const res = await deleteDocument(id);
            if (res.success) {
                toast({ title: 'Document Deleted' });
                void refreshData();
            } else {
                toast({ title: 'Delete Failed', description: res.error, variant: 'destructive' });
            }
        });
    };

    const onPickFile = (pick: SabFilePick) => {
        setFileUrl(pick.url);
        setFileName(pick.name);
        setFileMime(pick.mime ?? '');
        setFileSize(pick.size != null ? String(pick.size) : '');
    };

    const clearFile = () => {
        setFileUrl('');
        setFileName('');
        setFileMime('');
        setFileSize('');
    };

    const formatBytes = (bytes: unknown): string => {
        const b = Number(bytes);
        if (!b) return '—';
        if (b < 1024) return `${b} B`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
        return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    };

    // Calculate document count per category
    const categoryCounts = React.useMemo(() => {
        const counts: Record<string, number> = {};
        for (const doc of documents) {
            const cat = doc.category ?? 'other';
            counts[cat] = (counts[cat] ?? 0) + 1;
        }
        return counts;
    }, [documents]);

    return (
        <EntityListShell
            title="Workspace Documents"
            subtitle="View, upload and organize team documents and verification files."
            primaryAction={
                <Button onClick={openNew}>
                    <Plus className="mr-1.5 h-4 w-4" /> Upload Document
                </Button>
            }
            search={{
                value: searchQuery,
                onChange: setSearchQuery,
                placeholder: 'Search documents…',
            }}
        >
            <div className="flex flex-col gap-6">
                {/* Folder Browser */}
                <div>
                    <h3 className="mb-3 text-[14px] font-semibold text-[var(--st-text)]">Folders</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {CATEGORIES.map((cat) => {
                            const isActive = activeCategory === cat.value;
                            const count = cat.value === 'all' ? documents.length : (categoryCounts[cat.value] ?? 0);
                            return (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setActiveCategory(cat.value)}
                                    className={[
                                        'flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-200',
                                        isActive
                                            ? 'bg-[var(--st-bg-secondary)] border-[var(--st-text)] shadow-sm'
                                            : 'bg-[var(--st-bg)] border-[var(--st-border)] hover:border-[var(--st-text-secondary)]',
                                    ].join(' ')}
                                >
                                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                                        {isActive ? (
                                            <FolderOpen className="h-5 w-5" />
                                        ) : (
                                            <Folder className="h-5 w-5" />
                                        )}
                                    </div>
                                    <span className="text-[13px] font-semibold text-[var(--st-text)]">{cat.label}</span>
                                    <span className="text-[11.5px] text-[var(--st-text-secondary)]">{count} files</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Documents list table */}
                <Card className="p-0">
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Name</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Category</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Linked Employee</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Doc Number</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Size</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : documents.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={7} className="h-24 text-center text-[var(--st-text-secondary)]">
                                            No documents found in this folder.
                                        </Td>
                                    </Tr>
                                ) : (
                                    documents.map((d) => {
                                        const docStatus = (d.status ?? 'pending') as CrmDocumentStatus;
                                        const tone = STATUS_TONE[docStatus] ?? 'neutral';
                                        return (
                                            <Tr key={d._id} className="border-[var(--st-border)]">
                                                <Td className="font-semibold text-[var(--st-text)]">
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                                        {d.name}
                                                    </div>
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {(d.category ?? 'other').replace(/_/g, ' ')}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {d.employeeName ?? '—'}
                                                </Td>
                                                <Td className="font-mono text-[11.5px] text-[var(--st-text)]">
                                                    {d.documentNumber ?? '—'}
                                                </Td>
                                                <Td className="text-[var(--st-text-secondary)]">
                                                    {formatBytes(d.fileSize)}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={docStatus} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        {d.fileUrl && (
                                                            <Button variant="ghost" size="icon" asChild>
                                                                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                    <ExternalLink className="h-4 w-4" />
                                                                </a>
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                                                            <FileText className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(d._id)} disabled={isMutating}>
                                                            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                        </Button>
                                                    </div>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
                </Card>
            </div>

            {/* Document Upload / Edit Dialog */}
            {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <Card className="w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-[16px] font-bold text-[var(--st-text)]">
                                {editingDoc ? 'Edit Document' : 'Upload Document'}
                            </h2>
                            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Document Name */}
                            <div className="space-y-1">
                                <Label htmlFor="doc-name">Name *</Label>
                                <Input
                                    id="doc-name"
                                    value={docName}
                                    onChange={(e) => setDocName(e.target.value)}
                                    placeholder="e.g. Passport - John Doe"
                                    required
                                />
                            </div>

                            {/* Category + Doc Number */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Category</Label>
                                    <EnumFormField
                                        name="doc-category"
                                        enumName="documentCategory"
                                        initialId={category}
                                        onChange={(id) => setCategory((id as CrmDocumentCategory) ?? 'other')}
                                        allowInlineCreate={false}
                                        placeholder="Pick category…"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="doc-number">Document Number</Label>
                                    <Input
                                        id="doc-number"
                                        value={docNumber}
                                        onChange={(e) => setDocNumber(e.target.value)}
                                        placeholder="e.g. A1234567"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-1">
                                <Label htmlFor="doc-desc">Description</Label>
                                <Textarea
                                    id="doc-desc"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={2}
                                    placeholder="Short description of this document"
                                />
                            </div>

                            {/* SabFile Picker */}
                            <div className="space-y-1">
                                <Label>Attached file</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <SabFilePickerButton
                                        accept="document"
                                        onPick={onPickFile}
                                        title="Pick a document file"
                                    >
                                        <FileUp className="mr-1.5 h-4 w-4" />
                                        {fileUrl ? 'Replace file' : 'Choose from SabFiles'}
                                    </SabFilePickerButton>
                                    {fileUrl ? (
                                        <>
                                            <span className="max-w-[200px] truncate text-[12px] text-[var(--st-text)] font-mono">
                                                {fileName || fileUrl}
                                            </span>
                                            <Button type="button" variant="ghost" size="sm" onClick={clearFile}>
                                                Remove
                                            </Button>
                                        </>
                                    ) : (
                                        <span className="text-[12px] text-[var(--st-text-secondary)]">No file attached.</span>
                                    )}
                                </div>
                            </div>

                            {/* Linked Entity */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="employee-name">Employee Name</Label>
                                    <Input
                                        id="employee-name"
                                        value={employeeName}
                                        onChange={(e) => setEmployeeName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="entity-id">Entity ID</Label>
                                    <Input
                                        id="entity-id"
                                        value={entityId}
                                        onChange={(e) => setEntityId(e.target.value)}
                                        placeholder="Linked record ObjectId"
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="issue-date">Issue Date</Label>
                                    <Input
                                        id="issue-date"
                                        type="date"
                                        value={issueDate}
                                        onChange={(e) => setIssueDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="expiry-date">Expiry Date</Label>
                                    <Input
                                        id="expiry-date"
                                        type="date"
                                        value={expiryDate}
                                        onChange={(e) => setExpiryDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Tags & Status */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="doc-tags">Tags</Label>
                                    <Input
                                        id="doc-tags"
                                        value={tags}
                                        onChange={(e) => setTags(e.target.value)}
                                        placeholder="e.g. passport, visa"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Status</Label>
                                    <EnumFormField
                                        name="doc-status"
                                        enumName="documentStatus"
                                        initialId={status}
                                        onChange={(id) => setStatus((id as CrmDocumentStatus) ?? 'pending')}
                                        allowInlineCreate={false}
                                        placeholder="Status"
                                    />
                                </div>
                            </div>

                            {/* Notes + Confidential */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="doc-notes">Notes</Label>
                                    <Textarea
                                        id="doc-notes"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={2}
                                        placeholder="Internal notes"
                                    />
                                </div>
                                <div className="flex items-center gap-2 self-end pb-3">
                                    <Checkbox
                                        id="confidential"
                                        checked={isConfidential}
                                        onCheckedChange={(c) => setIsConfidential(!!c)}
                                    />
                                    <Label htmlFor="confidential" className="cursor-pointer">
                                        Confidential (HR only)
                                    </Label>
                                </div>
                            </div>

                            {/* Save / Cancel buttons */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={isMutating}>
                                    {isMutating ? 'Saving…' : 'Save Document'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </EntityListShell>
    );
}
