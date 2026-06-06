'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2,
  } from 'lucide-react';

/**
 * CRM Contract Templates — list page.
 *
 * Search + status + type filters with inline table. Uses the
 * `crm_contract_templates` Mongo collection through
 * `crm-contract-templates.actions.ts`. RBAC: `crm_contract_template`.
 * ZoruUI throughout.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteContractTemplate,
    getContractTemplates,
    type CrmContractTemplateDoc,
    type CrmContractTemplateStatus,
    type CrmContractTemplateType,
} from '@/app/actions/crm-contract-templates.actions';

const BASE = '/dashboard/crm/sales/contracts/templates';

const STATUS_OPTIONS: Array<{
    value: CrmContractTemplateStatus | 'all';
    label: string;
}> = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: Array<{
    value: CrmContractTemplateType | 'all';
    label: string;
}> = [
    { value: 'all', label: 'All types' },
    { value: 'service', label: 'Service' },
    { value: 'sales', label: 'Sales' },
    { value: 'nda', label: 'NDA' },
    { value: 'msa', label: 'MSA' },
    { value: 'sow', label: 'SOW' },
    { value: 'employment', label: 'Employment' },
    { value: 'other', label: 'Other' },
];

const STATUS_TONE: Record<CrmContractTemplateStatus, StatusTone> = {
    draft: 'amber',
    active: 'green',
    archived: 'neutral',
};

function prettify(s: string): string {
    return s.replace(/_/g, ' ');
}

export default function ContractTemplatesListPage() {
    const [items, setItems] = React.useState<CrmContractTemplateDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmContractTemplateStatus | 'all'
    >('all');
    const [typeFilter, setTypeFilter] = React.useState<
        CrmContractTemplateType | 'all'
    >('all');
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmContractTemplateDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getContractTemplates({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                type: typeFilter === 'all' ? undefined : typeFilter,
                limit: 100,
            });
            setItems(res.items ?? []);
        } catch {
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, typeFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteContractTemplate(id);
            if (result.success) {
                toast({ title: 'Template deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description:
                        result.error ?? 'Could not delete template.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Contract templates"
                    subtitle="Reusable contract bodies with default term, auto-renew and variables."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New
                                template
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search templates…',
                    }}
                    filters={
                        <>
                            {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                            <Select
                                value={statusFilter}
                                onValueChange={(v) =>
                                    setStatusFilter(
                                        v as CrmContractTemplateStatus | 'all',
                                    )
                                }
                            >
                                <SelectTrigger className="h-9 w-[180px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {/* TODO 1E.filter: convert to EnumFilterField once that wrapper exists */}
                            <Select
                                value={typeFilter}
                                onValueChange={(v) =>
                                    setTypeFilter(
                                        v as CrmContractTemplateType | 'all',
                                    )
                                }
                            >
                                <SelectTrigger className="h-9 w-[180px]">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TYPE_OPTIONS.map((o) => (
                                        <SelectItem
                                            key={o.value}
                                            value={o.value}
                                        >
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    }
                    loading={isLoading && items.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Name
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Type
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Term (months)
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Auto-renew
                                    </Th>
                                    <Th className="text-[var(--st-text-secondary)]">
                                        Variables
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
                                            No contract templates match this
                                            filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    items.map((t) => {
                                        const status = (t.status ??
                                            'draft') as CrmContractTemplateStatus;
                                        const tone =
                                            STATUS_TONE[status] ?? 'neutral';
                                        const vars = t.variables ?? [];
                                        return (
                                            <Tr
                                                key={t._id}
                                                className="border-[var(--st-border)]"
                                            >
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${t._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {t.name}
                                                    </Link>
                                                </Td>
                                                <Td className="uppercase text-[12px] font-mono text-[var(--st-text)]">
                                                    {t.type}
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {t.defaultTermMonths ?? '—'}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {t.defaultAutoRenew
                                                        ? 'Yes'
                                                        : 'No'}
                                                </Td>
                                                <Td>
                                                    {vars.length === 0 ? (
                                                        <span className="text-[var(--st-text-secondary)]">
                                                            —
                                                        </span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {vars
                                                                .slice(0, 3)
                                                                .map((v) => (
                                                                    <Badge
                                                                        key={v}
                                                                        variant="ghost"
                                                                        className="font-mono text-[11px]"
                                                                    >
                                                                        {v}
                                                                    </Badge>
                                                                ))}
                                                            {vars.length > 3 ? (
                                                                <span className="text-[11px] text-[var(--st-text-secondary)]">
                                                                    +
                                                                    {vars.length -
                                                                        3}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </Td>
                                                <Td>
                                                    <StatusPill
                                                        label={prettify(status)}
                                                        tone={tone}
                                                    />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={`${BASE}/${t._id}/edit`}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            setPendingDelete(t)
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

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete contract template?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will
                            remove it from the template picker. Existing
                            contracts using this template keep their content.
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
        </>
    );
}
