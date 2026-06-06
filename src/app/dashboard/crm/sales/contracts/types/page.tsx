'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Download,
  Edit,
  LoaderCircle,
  Plus,
  Trash2,
  X,
  } from 'lucide-react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

/**
 * CRM Contract Types — settings-style list.
 *
 * Inline-create / edit via dialog with code, name, description, default
 * term length, default-template pointer and active toggle. Mirrors the
 * pattern in `crm/accounting/groups/page.tsx`.
 *
 * RBAC: `crm_contract_type`. ZoruUI throughout.
 */

import * as React from 'react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EnumFilterField } from '@/components/crm/enum-filter-field';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteContractType,
    getContractTypes,
    saveContractType,
    type CrmContractTypeDoc,
    type CrmContractTypeStatus,
} from '@/app/actions/crm-contract-types.actions';

const STATUS_TONE: Record<CrmContractTypeStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

const saveInitialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEditing ? 'Save changes' : 'Create type'}
        </Button>
    );
}

function ContractTypeDialog({
    isOpen,
    onOpenChange,
    onSaved,
    initialData,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
    initialData: CrmContractTypeDoc | null;
}) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(
        saveContractType,
        saveInitialState,
    );
    const { toast } = useToast();
    const [status, setStatus] = React.useState<CrmContractTypeStatus>(
        (initialData?.status as CrmContractTypeStatus) ?? 'active',
    );

    React.useEffect(() => {
        setStatus(
            (initialData?.status as CrmContractTypeStatus) ?? 'active',
        );
    }, [initialData]);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Saved', description: state.message });
            onSaved();
            onOpenChange(false);
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, onSaved, onOpenChange]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <form action={formAction}>
                    {isEditing ? (
                        <input
                            type="hidden"
                            name="typeId"
                            value={initialData!._id}
                        />
                    ) : null}
                    <input type="hidden" name="status" value={status} />

                    <DialogHeader>
                        <DialogTitle>
                            {isEditing ? 'Edit' : 'Create new'} contract type
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    required
                                    placeholder="e.g. Service Contract"
                                    defaultValue={initialData?.name ?? ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="code">Code *</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    required
                                    placeholder="e.g. SC"
                                    defaultValue={initialData?.code ?? ''}
                                    className="uppercase"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="description">
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                name="description"
                                rows={2}
                                placeholder="Optional short description shown in pickers."
                                defaultValue={initialData?.description ?? ''}
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="defaultTermMonths">
                                    Default term (months)
                                </Label>
                                <Input
                                    id="defaultTermMonths"
                                    name="defaultTermMonths"
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="e.g. 12"
                                    defaultValue={
                                        initialData?.defaultTermMonths ?? ''
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="defaultTemplateId">
                                    Default template id
                                </Label>
                                <Input
                                    id="defaultTemplateId"
                                    name="defaultTemplateId"
                                    placeholder="Optional template _id"
                                    defaultValue={
                                        initialData?.defaultTemplateId ?? ''
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Status</Label>
                                <EnumFormField
                                    enumName="contractTypeStatus"
                                    name="__status_picker"
                                    initialId={status}
                                    onChange={(v) =>
                                        setStatus((v ?? 'active') as CrmContractTypeStatus)
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2 self-end pb-1.5">
                                <Checkbox
                                    id="isActive"
                                    name="isActive"
                                    defaultChecked={
                                        initialData?.isActive !== false
                                    }
                                />
                                <Label
                                    htmlFor="isActive"
                                    className="cursor-pointer"
                                >
                                    Available for selection
                                </Label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function ContractTypesPage() {
    const [items, setItems] = React.useState<CrmContractTypeDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [editing, setEditing] = React.useState<CrmContractTypeDoc | null>(
        null,
    );
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmContractTypeStatus | 'all'
    >('all');
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmContractTypeDoc | null>(null);
    const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getContractTypes({
                q: search.trim() || undefined,
                status:
                    statusFilter === 'all' ? undefined : statusFilter,
            });
            setItems(res.items ?? []);
        } catch {
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleOpenDialog = (row: CrmContractTypeDoc | null) => {
        setEditing(row);
        setIsDialogOpen(true);
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteContractType(id);
            if (result.success) {
                toast({ title: 'Contract type deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete.',
                    variant: 'destructive',
                });
            }
        });
    };

    /* Bulk selection helpers */
    const allIds = React.useMemo(() => items.map((r) => r._id), [items]);
    const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

    const toggleRow = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = React.useCallback(() => {
        setSelected(allSelected ? new Set() : new Set(allIds));
    }, [allSelected, allIds]);

    const clearSelection = React.useCallback(() => setSelected(new Set()), []);

    /* Bulk delete */
    const confirmBulkDelete = () => {
        startDeleteTransition(async () => {
            let ok = 0;
            let fail = 0;
            for (const id of selected) {
                const res = await deleteContractType(id);
                if (res.success) ok += 1;
                else fail += 1;
            }
            toast({
                title: `Deleted ${ok}`,
                description: fail > 0 ? `${fail} failed.` : 'All selected removed.',
                variant: fail > 0 ? 'destructive' : undefined,
            });
            clearSelection();
            setPendingBulkDelete(false);
            await refresh();
        });
    };

    /* Export CSV */
    const exportCsv = React.useCallback(() => {
        const rows = items.filter(
            (r) => selected.size === 0 || selected.has(r._id),
        );
        if (rows.length === 0) {
            toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
            return;
        }
        const headers = ['code', 'name', 'description', 'defaultTermMonths', 'status', 'isActive'];
        const exportRows = rows.map((r) => ({
            code: r.code ?? '',
            name: r.name ?? '',
            description: r.description ?? '',
            defaultTermMonths: r.defaultTermMonths ?? '',
            status: r.status ?? '',
            isActive: r.isActive !== false ? 'true' : 'false',
        }));
        downloadCsv(`contract-types-${dateStamp()}.csv`, headers, exportRows);
        toast({ title: 'Exported', description: `${rows.length} contract types saved to CSV.` });
    }, [items, selected, toast]);

    /* KPI counts */
    const kpi = React.useMemo(() => {
        const total = items.length;
        const active = items.filter((r) => (r.status ?? 'active') === 'active').length;
        const archived = items.filter((r) => r.status === 'archived').length;
        return { total, active, archived };
    }, [items]);

    return (
        <>
            <ContractTypeDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSaved={refresh}
                initialData={editing}
            />

            <EntityListShell
                    title="Contract types"
                    subtitle="Categorise contracts (Service, MSA, NDA…) with default term length and template."
                    primaryAction={
                        <Button onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New type
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search contract types…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="contractTypeStatus"
                            value={statusFilter}
                            onChange={(v) =>
                                setStatusFilter(v as CrmContractTypeStatus | 'all')
                            }
                            placeholder="All statuses"
                        />
                    }
                    bulkBar={
                        selected.size > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                                <span className="font-medium text-[var(--st-text)]">{selected.size} selected</span>
                                <Button size="sm" variant="ghost" onClick={exportCsv}>
                                    <Download className="h-3.5 w-3.5" /> Export CSV
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setPendingBulkDelete(true)}
                                    disabled={deletePending}
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </Button>
                                <Button size="sm" variant="ghost" onClick={clearSelection}>
                                    <X className="h-3.5 w-3.5" /> Clear
                                </Button>
                            </div>
                        ) : null
                    }
                    loading={isLoading && items.length === 0}
                >
                    {/* KPI strip */}
                    <div className="mb-4 grid grid-cols-3 gap-3">
                        <Card className="p-0">
                            <CardHeader className="pb-1 pt-3 px-4">
                                <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                                    Total
                                </CardTitle>
                            </CardHeader>
                            <CardBody className="pb-3 px-4">
                                <span className="text-2xl font-semibold tabular-nums text-[var(--st-text)]">
                                    {kpi.total}
                                </span>
                            </CardBody>
                        </Card>
                        <Card className="p-0 border-[var(--st-border)]/30">
                            <CardHeader className="pb-1 pt-3 px-4">
                                <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                                    Active
                                </CardTitle>
                            </CardHeader>
                            <CardBody className="pb-3 px-4">
                                <span className="text-2xl font-semibold tabular-nums text-[var(--st-text)]">
                                    {kpi.active}
                                </span>
                            </CardBody>
                        </Card>
                        <Card className="p-0 border-[var(--st-border)]">
                            <CardHeader className="pb-1 pt-3 px-4">
                                <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                                    Archived
                                </CardTitle>
                            </CardHeader>
                            <CardBody className="pb-3 px-4">
                                <span className="text-2xl font-semibold tabular-nums text-[var(--st-text)]">
                                    {kpi.archived}
                                </span>
                            </CardBody>
                        </Card>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="w-[36px]">
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={toggleAll}
                                            aria-label="Select all"
                                        />
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Code
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Name
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Description
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Default term
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Status
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">
                                        Actions
                                    </Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center"
                                        >
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : items.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No contract types match this
                                            filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    items.map((row) => {
                                        const status = (row.status ??
                                            'active') as CrmContractTypeStatus;
                                        const tone =
                                            STATUS_TONE[status] ?? 'neutral';
                                        const isSelected = selected.has(row._id);
                                        return (
                                            <Tr
                                                key={row._id}
                                                className="border-[var(--st-border)]"
                                                data-state={isSelected ? 'selected' : undefined}
                                            >
                                                <Td>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleRow(row._id)}
                                                        aria-label={`Select ${row.name}`}
                                                    />
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {row.code}
                                                </Td>
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    {row.name}
                                                </Td>
                                                <Td className="text-[var(--st-text-secondary)]">
                                                    {row.description ?? '—'}
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {row.defaultTermMonths != null
                                                        ? `${row.defaultTermMonths} mo`
                                                        : '—'}
                                                </Td>
                                                <Td>
                                                    <StatusPill
                                                        label={status}
                                                        tone={tone}
                                                    />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            handleOpenDialog(
                                                                row,
                                                            )
                                                        }
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            setPendingDelete(
                                                                row,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
                </EntityListShell>

            {/* Single delete */}
            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete contract type?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will
                            remove it from the type picker. Existing contracts
                            keep their stored type label.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk delete */}
            <AlertDialog
                open={pendingBulkDelete}
                onOpenChange={(o) => !o && setPendingBulkDelete(false)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {selected.size} contract type{selected.size === 1 ? '' : 's'}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This removes the selected types from the type
                            picker. Existing contracts keep their stored type
                            label.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmBulkDelete}
                            disabled={deletePending}
                            className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
                        >
                            {deletePending ? (
                                <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Delete permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
