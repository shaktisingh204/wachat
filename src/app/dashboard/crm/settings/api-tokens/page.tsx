'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Checkbox, Input, PageDescription, PageHeader, PageHeading, PageTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Check,
  Download,
  Key,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';

/**
 * CRM Settings — API Tokens list.
 *
 * Lists every token issued for the current tenant. Token rows show name,
 * prefix, scope count, expiry and last-used time. New tokens are created
 * on the `/new` sub-route so the raw token can be shown exactly once.
 *
 * Additions:
 *  - Filter row: search by name/description, status select
 *  - Checkbox multi-select
 *  - Bulk revoke + bulk delete with confirm
 *  - Export CSV (name, created, last used, status — NEVER the token value)
 */

import * as React from 'react';
import Link from 'next/link';

import {
    bulkDeleteApiTokens,
    bulkRevokeApiTokens,
    getApiTokens,
    revokeApiToken,
    testApiToken,
    type CrmApiTokenRow,
} from '@/app/actions/crm-api-tokens.actions';
import { RowDrawer } from '@/components/crm/row-drawer';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import { formatUTC } from '@/lib/utils';

type StatusFilter = 'all' | 'active' | 'revoked';

function formatDate(iso: string | null): string {
    return formatUTC(iso ?? undefined, true);
}

export default function CrmApiTokensPage() {
    const toast = useToast();
    const [rows, setRows] = React.useState<CrmApiTokenRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [pending, startTransition] = React.useTransition();

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

    // Selection
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    // Bulk dialogs
    const [bulkRevokeOpen, setBulkRevokeOpen] = React.useState(false);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            const data = await getApiTokens();
            setRows(data);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    // Filtered rows
    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (statusFilter === 'active' && r.revoked) return false;
            if (statusFilter === 'revoked' && !r.revoked) return false;
            if (!q) return true;
            return r.name.toLowerCase().includes(q) ||
                r.prefix.toLowerCase().includes(q);
        });
    }, [rows, search, statusFilter]);

    // Selection helpers
    const allFilteredIds = React.useMemo(
        () => filtered.map((r) => r._id),
        [filtered],
    );
    const allChecked =
        allFilteredIds.length > 0 &&
        allFilteredIds.every((id) => selected.has(id));
    const someChecked = allFilteredIds.some((id) => selected.has(id));

    const toggleAll = () => {
        if (allChecked) {
            setSelected((prev) => {
                const next = new Set(prev);
                allFilteredIds.forEach((id) => next.delete(id));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                allFilteredIds.forEach((id) => next.add(id));
                return next;
            });
        }
    };

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedIds = [...selected].filter((id) =>
        allFilteredIds.includes(id),
    );

    // Single revoke
    const handleRevoke = (id: string) => {
        startTransition(async () => {
            const res = await revokeApiToken(id);
            if (!res.ok) {
                toast.toast({
                    title: 'Failed to revoke',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            toast.toast({ title: 'Token revoked' });
            await refresh();
        });
    };

    // Test token validity
    const handleTestToken = (id: string) => {
        startTransition(async () => {
            const res = await testApiToken(id);
            if (!res.ok) {
                toast.toast({
                    title: 'Token check failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            if (res.status === 'valid') {
                toast.toast({
                    title: 'Token is active & valid',
                    description: `Name: ${res.name}. Scopes: ${res.scopes.join(', ')}`,
                });
            } else {
                toast.toast({
                    title: `Token is ${res.status}`,
                    description: `This token is inactive (status: ${res.status}).`,
                    variant: 'destructive',
                });
            }
        });
    };

    // Bulk revoke
    const handleBulkRevoke = () => {
        startTransition(async () => {
            const res = await bulkRevokeApiTokens(selectedIds);
            if (!res.ok) {
                toast.toast({
                    title: 'Bulk revoke failed',
                    description: res.error,
                    variant: 'destructive',
                });
            } else {
                toast.toast({ title: `${res.count} token(s) revoked` });
                setSelected(new Set());
            }
            setBulkRevokeOpen(false);
            await refresh();
        });
    };

    // Bulk delete
    const handleBulkDelete = () => {
        startTransition(async () => {
            const res = await bulkDeleteApiTokens(selectedIds);
            if (!res.ok) {
                toast.toast({
                    title: 'Bulk delete failed',
                    description: res.error,
                    variant: 'destructive',
                });
            } else {
                toast.toast({ title: `${res.count} token(s) deleted` });
                setSelected(new Set());
            }
            setBulkDeleteOpen(false);
            await refresh();
        });
    };

    // Export CSV — NEVER export token values, only metadata
    const handleExport = () => {
        const exportRows = filtered.map((r) => ({
            Name: r.name,
            Prefix: `${r.prefix}…`,
            Scopes: r.scopes.length,
            Created: formatDate(r.createdAt),
            'Last used': formatDate(r.lastUsedAt),
            Expires: formatDate(r.expiresAt),
            Status: r.revoked ? 'revoked' : 'active',
        }));
        downloadCsv(`api-tokens-${dateStamp()}.csv`, Object.keys(exportRows[0] ?? {}), exportRows);
        toast.toast({ title: 'CSV exported' });
    };

    const activeCount = rows.filter((r) => !r.revoked).length;
    const revokedCount = rows.filter((r) => r.revoked).length;
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expiringSoonCount = rows.filter((r) => {
        if (r.revoked || !r.expiresAt) return false;
        const exp = new Date(r.expiresAt).getTime();
        return exp > now && exp - now < thirtyDays;
    }).length;
    const hasSelection = selectedIds.length > 0;

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/crm/settings">
                            CRM Settings
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>API Tokens</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <PageHeading>
                            <Key className="size-5" />
                            <PageTitle>API Tokens</PageTitle>
                        </PageHeading>
                        <PageDescription>
                            Bearer tokens for the CRM public REST API. {activeCount} active.
                        </PageDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
                            <Download className="mr-2 size-4" />
                            Export CSV
                        </Button>
                        <Link href="/dashboard/crm/settings/api-tokens/new">
                            <Button>
                                <Plus className="mr-2 size-4" />
                                New token
                            </Button>
                        </Link>
                    </div>
                </div>
            </PageHeader>

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Total tokens" value={rows.length.toLocaleString()} />
                <StatCard label="Active" value={activeCount.toLocaleString()} />
                <StatCard label="Expiring soon" value={expiringSoonCount.toLocaleString()} />
                <StatCard label="Revoked" value={revokedCount.toLocaleString()} />
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search token name…"
                    className="h-9 w-[220px] text-[13px]"
                />
                <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                    <SelectTrigger className="h-9 w-[160px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                </Select>
                {(search || statusFilter !== 'all') && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setStatusFilter('all');
                        }}
                    >
                        Clear
                    </Button>
                )}
            </div>

            {/* Bulk action bar */}
            {hasSelection && (
                <div className="flex items-center gap-3 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 px-4 py-2.5 text-sm">
                    <span className="font-medium text-[var(--st-text)]">
                        {selectedIds.length} selected
                    </span>
                    <div className="flex items-center gap-2">
                        <AlertDialog open={bulkRevokeOpen} onOpenChange={setBulkRevokeOpen}>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pending}
                                >
                                    Revoke selected
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke {selectedIds.length} token(s)?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        All selected tokens will stop working immediately. This cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleBulkRevoke} disabled={pending}>
                                        {pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
                                        Revoke
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                            <AlertDialogTrigger asChild>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={pending}
                                >
                                    <Trash2 className="mr-1.5 size-3.5" />
                                    Delete selected
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {selectedIds.length} token(s)?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete the selected tokens. Integrations using them will stop working immediately.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleBulkDelete} disabled={pending}>
                                        {pending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(new Set())}
                        >
                            Clear selection
                        </Button>
                    </div>
                </div>
            )}

            <Card className="p-0">
                <Table>
                    <THead>
                        <Tr>
                            <Th className="w-10">
                                <Checkbox
                                    checked={allChecked}
                                    aria-checked={someChecked && !allChecked ? 'mixed' : allChecked}
                                    onCheckedChange={toggleAll}
                                    aria-label="Select all"
                                    disabled={filtered.length === 0}
                                />
                            </Th>
                            <Th>Name</Th>
                            <Th>Prefix</Th>
                            <Th>Scopes</Th>
                            <Th>Created</Th>
                            <Th>Last used</Th>
                            <Th>Expires</Th>
                            <Th className="text-right">Actions</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <Tr key={i}>
                                    <Td colSpan={8}>
                                        <Skeleton className="h-6 w-full" />
                                    </Td>
                                </Tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <Tr>
                                <Td
                                    colSpan={8}
                                    className="text-center text-[var(--st-text-secondary)] py-12"
                                >
                                    {rows.length === 0
                                        ? 'No tokens yet. Create one to access the CRM API.'
                                        : 'No tokens match this filter.'}
                                </Td>
                            </Tr>
                        ) : (
                            filtered.map((row) => (
                                <Tr key={row._id}>
                                    <Td>
                                        <Checkbox
                                            checked={selected.has(row._id)}
                                            onCheckedChange={() => toggleOne(row._id)}
                                            aria-label={`Select ${row.name}`}
                                        />
                                    </Td>
                                    <Td className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <RowDrawer
                                                label={row.name}
                                                subtitle={`Prefix ${row.prefix}…`}
                                                title={`API Token · ${row.name}`}
                                                description="Read-only token details."
                                            >
                                                <div className="space-y-3 text-sm">
                                                    <div>
                                                        <div className="text-[var(--st-text-secondary)] text-xs">Prefix</div>
                                                        <div className="font-mono">{row.prefix}…</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[var(--st-text-secondary)] text-xs">Scopes</div>
                                                        <div>{row.scopes.length} scope{row.scopes.length === 1 ? '' : 's'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[var(--st-text-secondary)] text-xs">Status</div>
                                                        <div>{row.revoked ? 'Revoked' : 'Active'}</div>
                                                    </div>
                                                </div>
                                            </RowDrawer>
                                            {row.revoked && (
                                                <Badge variant="danger">
                                                    revoked
                                                </Badge>
                                            )}
                                        </div>
                                    </Td>
                                    <Td className="font-mono text-xs">
                                        {row.prefix}…
                                    </Td>
                                    <Td>
                                        <Badge variant="outline">
                                            {row.scopes.length} scope
                                            {row.scopes.length === 1 ? '' : 's'}
                                        </Badge>
                                    </Td>
                                    <Td>{formatDate(row.createdAt)}</Td>
                                    <Td>{formatDate(row.lastUsedAt)}</Td>
                                    <Td>{formatDate(row.expiresAt)}</Td>
                                    <Td className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={pending}
                                                onClick={() => handleTestToken(row._id)}
                                                title="Test Token"
                                            >
                                                <Check className="size-4 text-[var(--st-text)]" />
                                            </Button>
                                            {!row.revoked && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={pending}
                                                        >
                                                            {pending ? (
                                                                <LoaderCircle className="size-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="size-4" />
                                                            )}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                                Revoke this token?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Any integration using <strong>{row.name}</strong>{' '}
                                                                will immediately stop working. This cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleRevoke(row._id)}
                                                            >
                                                                Revoke
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </TBody>
                </Table>
            </Card>
        </div>
    );
}
