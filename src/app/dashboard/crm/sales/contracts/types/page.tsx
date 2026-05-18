'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Edit,
  FileType2,
  LoaderCircle,
  Plus,
  Trash2,
  } from 'lucide-react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

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

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteContractType,
    getContractTypes,
    saveContractType,
    type CrmContractTypeDoc,
    type CrmContractTypeStatus,
} from '@/app/actions/crm-contract-types.actions';

const STATUS_OPTIONS: Array<{
    value: CrmContractTypeStatus | 'all';
    label: string;
}> = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmContractTypeStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

const saveInitialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEditing ? 'Save changes' : 'Create type'}
        </ZoruButton>
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
    const { toast } = useZoruToast();
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
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent>
                <form action={formAction}>
                    {isEditing ? (
                        <input
                            type="hidden"
                            name="typeId"
                            value={initialData!._id}
                        />
                    ) : null}
                    <input type="hidden" name="status" value={status} />

                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {isEditing ? 'Edit' : 'Create new'} contract type
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                                <ZoruInput
                                    id="name"
                                    name="name"
                                    required
                                    placeholder="e.g. Service Contract"
                                    defaultValue={initialData?.name ?? ''}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="code">Code *</ZoruLabel>
                                <ZoruInput
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
                            <ZoruLabel htmlFor="description">
                                Description
                            </ZoruLabel>
                            <ZoruTextarea
                                id="description"
                                name="description"
                                rows={2}
                                placeholder="Optional short description shown in pickers."
                                defaultValue={initialData?.description ?? ''}
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="defaultTermMonths">
                                    Default term (months)
                                </ZoruLabel>
                                <ZoruInput
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
                                <ZoruLabel htmlFor="defaultTemplateId">
                                    Default template id
                                </ZoruLabel>
                                <ZoruInput
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
                                <ZoruLabel>Status</ZoruLabel>
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
                                <ZoruCheckbox
                                    id="isActive"
                                    name="isActive"
                                    defaultChecked={
                                        initialData?.isActive !== false
                                    }
                                />
                                <ZoruLabel
                                    htmlFor="isActive"
                                    className="cursor-pointer"
                                >
                                    Available for selection
                                </ZoruLabel>
                            </div>
                        </div>
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
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
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

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

    return (
        <>
            <ContractTypeDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSaved={refresh}
                initialData={editing}
            />

            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'Sales', href: '/dashboard/crm/sales' },
                        {
                            label: 'Contracts',
                            href: '/dashboard/crm/sales/contracts',
                        },
                        { label: 'Types' },
                    ]}
                    title="Contract types"
                    subtitle="Categorise contracts (Service, MSA, NDA…) with default term length and template."
                    icon={FileType2}
                    actions={
                        <ZoruButton onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New type
                        </ZoruButton>
                    }
                />

                <EntityListShell
                    title=""
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search contract types…',
                    }}
                    filters={
                        {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                        <ZoruSelect
                            value={statusFilter}
                            onValueChange={(v) =>
                                setStatusFilter(
                                    v as CrmContractTypeStatus | 'all',
                                )
                            }
                        >
                            <ZoruSelectTrigger className="h-9 w-[180px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem
                                        key={o.value}
                                        value={o.value}
                                    >
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    }
                    loading={isLoading && items.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Code
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Name
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Description
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Default term
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">
                                        Status
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={6}
                                            className="h-24 text-center"
                                        >
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : items.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={6}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No contract types match this
                                            filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    items.map((row) => {
                                        const status = (row.status ??
                                            'active') as CrmContractTypeStatus;
                                        const tone =
                                            STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow
                                                key={row._id}
                                                className="border-zoru-line"
                                            >
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {row.code}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    {row.name}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink-muted">
                                                    {row.description ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {row.defaultTermMonths != null
                                                        ? `${row.defaultTermMonths} mo`
                                                        : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill
                                                        label={status}
                                                        tone={tone}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            handleOpenDialog(
                                                                row,
                                                            )
                                                        }
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            setPendingDelete(
                                                                row,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </ZoruButton>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </EntityListShell>
            </div>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete contract type?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will
                            remove it from the type picker. Existing contracts
                            keep their stored type label.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
