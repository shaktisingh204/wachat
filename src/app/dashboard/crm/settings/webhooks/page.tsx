'use client';

import {
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
} from '@/components/zoruui';
import {
  LoaderCircle,
  Plus,
  Webhook } from 'lucide-react';

/**
 * CRM Settings — Webhook subscriptions list (Phase 7 foundation).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
    getWebhookSubscriptions,
    type CrmWebhookRow,
} from '@/app/actions/crm-webhooks.actions';

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function CrmWebhooksListPage() {
    const [rows, setRows] = React.useState<CrmWebhookRow[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            const data = await getWebhookSubscriptions();
            if (mounted) {
                setRows(data);
                setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

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
                        <ZoruBreadcrumbPage>Webhooks</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </ZoruBreadcrumb>

            <ZoruPageHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <ZoruPageHeading>
                            <Webhook className="size-5" />
                            <ZoruPageTitle>Webhook subscriptions</ZoruPageTitle>
                        </ZoruPageHeading>
                        <ZoruPageDescription>
                            Receive HTTP callbacks when CRM records change. Payloads are
                            signed with HMAC-SHA-256.
                        </ZoruPageDescription>
                    </div>
                    <Link href="/dashboard/crm/settings/webhooks/new">
                        <ZoruButton>
                            <Plus className="mr-2 size-4" />
                            New webhook
                        </ZoruButton>
                    </Link>
                </div>
            </ZoruPageHeader>

            <ZoruCard className="p-0">
                <ZoruTable>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead>Name</ZoruTableHead>
                            <ZoruTableHead>Target URL</ZoruTableHead>
                            <ZoruTableHead>Events</ZoruTableHead>
                            <ZoruTableHead>Status</ZoruTableHead>
                            <ZoruTableHead>Last delivery</ZoruTableHead>
                            <ZoruTableHead className="text-right">Failures</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <ZoruTableRow key={i}>
                                    <ZoruTableCell colSpan={6}>
                                        <ZoruSkeleton className="h-6 w-full" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))
                        ) : rows.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell
                                    colSpan={6}
                                    className="text-center text-muted-foreground py-12"
                                >
                                    No subscriptions yet.
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            rows.map((row) => (
                                <ZoruTableRow key={row._id}>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/settings/webhooks/${row._id}`}
                                            label={row.name}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs truncate max-w-[280px]">
                                        {row.targetUrl}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <ZoruBadge variant="outline">
                                            {row.events.length} event
                                            {row.events.length === 1 ? '' : 's'}
                                        </ZoruBadge>
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <ZoruBadge
                                            variant={
                                                row.status === 'active' ? 'default' : 'secondary'
                                            }
                                        >
                                            {row.status}
                                        </ZoruBadge>
                                    </ZoruTableCell>
                                    <ZoruTableCell>{formatDate(row.lastDeliveryAt)}</ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        {row.failureCount}
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
