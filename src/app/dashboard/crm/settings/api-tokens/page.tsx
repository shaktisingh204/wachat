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
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Key,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * CRM Settings — API Tokens list (Phase 7 foundation).
 *
 * Lists every token issued for the current tenant. Token rows show name,
 * prefix, scope count, expiry and last-used time. New tokens are created
 * on the `/new` sub-route so the raw token can be shown exactly once.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    getApiTokens,
    revokeApiToken,
    type CrmApiTokenRow,
} from '@/app/actions/crm-api-tokens.actions';
import { RowDrawer } from '@/components/crm/row-drawer';

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function CrmApiTokensPage() {
    const toast = useZoruToast();
    const [rows, setRows] = React.useState<CrmApiTokenRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [pending, startTransition] = React.useTransition();

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

    const activeCount = rows.filter((r) => !r.revoked).length;

    return (
        <div className="flex min-h-full flex-col gap-6">
            <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/crm/settings">
                            CRM Settings
                        </ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>API Tokens</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <ZoruPageHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <ZoruPageHeading>
                            <Key className="size-5" />
                            <ZoruPageTitle>API Tokens</ZoruPageTitle>
                        </ZoruPageHeading>
                        <ZoruPageDescription>
                            Bearer tokens for the CRM public REST API. {activeCount} active.
                        </ZoruPageDescription>
                    </div>
                    <Link href="/dashboard/crm/settings/api-tokens/new">
                        <ZoruButton>
                            <Plus className="mr-2 size-4" />
                            New token
                        </ZoruButton>
                    </Link>
                </div>
            </ZoruPageHeader>

            <ZoruCard className="p-0">
                <ZoruTable>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead>Name</ZoruTableHead>
                            <ZoruTableHead>Prefix</ZoruTableHead>
                            <ZoruTableHead>Scopes</ZoruTableHead>
                            <ZoruTableHead>Created</ZoruTableHead>
                            <ZoruTableHead>Last used</ZoruTableHead>
                            <ZoruTableHead>Expires</ZoruTableHead>
                            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <ZoruTableRow key={i}>
                                    <ZoruTableCell colSpan={7}>
                                        <ZoruSkeleton className="h-6 w-full" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))
                        ) : rows.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell
                                    colSpan={7}
                                    className="text-center text-muted-foreground py-12"
                                >
                                    No tokens yet. Create one to access the CRM API.
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            rows.map((row) => (
                                <ZoruTableRow key={row._id}>
                                    <ZoruTableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <RowDrawer
                                                label={row.name}
                                                subtitle={`Prefix ${row.prefix}…`}
                                                title={`API Token · ${row.name}`}
                                                description="Read-only token details. Edit form coming in Batch 4."
                                            >
                                                <div className="space-y-3 text-sm">
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Prefix</div>
                                                        <div className="font-mono">{row.prefix}…</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Scopes</div>
                                                        <div>{row.scopes.length} scope{row.scopes.length === 1 ? '' : 's'}</div>
                                                    </div>
                                                    <p className="text-muted-foreground text-xs">
                                                        Edit form coming in Batch 4.
                                                    </p>
                                                </div>
                                            </RowDrawer>
                                            {row.revoked && (
                                                <ZoruBadge variant="danger">
                                                    revoked
                                                </ZoruBadge>
                                            )}
                                        </div>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs">
                                        {row.prefix}…
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <ZoruBadge variant="outline">
                                            {row.scopes.length} scope
                                            {row.scopes.length === 1 ? '' : 's'}
                                        </ZoruBadge>
                                    </ZoruTableCell>
                                    <ZoruTableCell>{formatDate(row.createdAt)}</ZoruTableCell>
                                    <ZoruTableCell>{formatDate(row.lastUsedAt)}</ZoruTableCell>
                                    <ZoruTableCell>{formatDate(row.expiresAt)}</ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        {!row.revoked && (
                                            <ZoruAlertDialog>
                                                <ZoruAlertDialogTrigger asChild>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={pending}
                                                    >
                                                        {pending ? (
                                                            <LoaderCircle className="size-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="size-4" />
                                                        )}
                                                    </ZoruButton>
                                                </ZoruAlertDialogTrigger>
                                                <ZoruAlertDialogContent>
                                                    <ZoruAlertDialogHeader>
                                                        <ZoruAlertDialogTitle>
                                                            Revoke this token?
                                                        </ZoruAlertDialogTitle>
                                                        <ZoruAlertDialogDescription>
                                                            Any integration using <strong>{row.name}</strong>{' '}
                                                            will immediately stop working. This cannot be undone.
                                                        </ZoruAlertDialogDescription>
                                                    </ZoruAlertDialogHeader>
                                                    <ZoruAlertDialogFooter>
                                                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                                        <ZoruAlertDialogAction
                                                            onClick={() => handleRevoke(row._id)}
                                                        >
                                                            Revoke
                                                        </ZoruAlertDialogAction>
                                                    </ZoruAlertDialogFooter>
                                                </ZoruAlertDialogContent>
                                            </ZoruAlertDialog>
                                        )}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))
                        )}
                    </ZoruTableBody>
                </ZoruTable>
            </ZoruCard>
        </div>
    );
}
