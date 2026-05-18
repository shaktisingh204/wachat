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
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';
import {
  Edit,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2,
  Webhook,
  } from 'lucide-react';

/**
 * <IntegrationsList /> — client list of custom CRM integrations.
 *
 * Each row shows: name, provider chip, masked credentials badge
 * (`***hidden***`), webhook URL, last sync, active toggle, and
 * Edit / Delete actions. Plaintext credentials are NEVER displayed.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteIntegration,
    setIntegrationActive,
    type CrmIntegrationDoc,
} from '@/app/actions/crm-integrations.actions';

const BASE = '/dashboard/crm/integrations';

const PROVIDER_TONE: Record<string, StatusTone> = {
    slack: 'blue',
    zapier: 'amber',
    webhook: 'neutral',
    gmail: 'red',
    outlook: 'blue',
    zoom: 'blue',
    teams: 'blue',
    stripe: 'green',
    shopify: 'green',
    mailchimp: 'amber',
    whatsapp: 'green',
    facebook: 'blue',
    twilio: 'red',
    hubspot: 'amber',
    salesforce: 'blue',
    other: 'neutral',
};

const STATUS_TONE: Record<string, StatusTone> = {
    connected: 'green',
    disconnected: 'neutral',
    error: 'red',
};

function fmtDateTime(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function IntegrationsList({ items }: { items: CrmIntegrationDoc[] }) {
    const { toast } = useZoruToast();
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmIntegrationDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const [togglePending, startToggleTransition] = React.useTransition();
    const [optimisticActive, setOptimisticActive] = React.useState<
        Record<string, boolean>
    >({});

    const handleToggle = (item: CrmIntegrationDoc, next: boolean) => {
        setOptimisticActive((prev) => ({ ...prev, [item._id]: next }));
        startToggleTransition(async () => {
            const res = await setIntegrationActive(item._id, next);
            if (!res.success) {
                setOptimisticActive((prev) => ({ ...prev, [item._id]: !next }));
                toast({
                    title: 'Update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const res = await deleteIntegration(id);
            if (res.success) {
                toast({ title: 'Integration deleted' });
                setPendingDelete(null);
            } else {
                toast({
                    title: 'Delete failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    if (items.length === 0) {
        return (
            <ZoruCard className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Webhook className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                    <div className="text-[14px] font-medium text-zoru-ink">
                        No custom integrations yet
                    </div>
                    <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                        Wire up a Slack channel, a webhook, or a third-party API key.
                    </p>
                </div>
                <ZoruButton variant="outline" size="sm" asChild>
                    <Link href={`${BASE}/new`}>
                        <Plus className="h-4 w-4" /> Add integration
                    </Link>
                </ZoruButton>
            </ZoruCard>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {items.map((item) => {
                    const isActive =
                        optimisticActive[item._id] ?? item.isActive;
                    const tone = PROVIDER_TONE[item.provider] ?? 'neutral';
                    const statusTone =
                        STATUS_TONE[item.status ?? 'disconnected'] ?? 'neutral';
                    return (
                        <ZoruCard
                            key={item._id}
                            className="flex flex-col gap-3 p-5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`${BASE}/${item._id}/edit`}
                                            className="truncate text-[14px] font-semibold text-zoru-ink hover:underline"
                                        >
                                            {item.name}
                                        </Link>
                                        <StatusPill
                                            label={item.provider}
                                            tone={tone}
                                        />
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-zoru-ink-muted">
                                        <StatusPill
                                            label={item.status ?? 'disconnected'}
                                            tone={statusTone}
                                        />
                                        {item.syncStatus ? (
                                            <span>sync: {item.syncStatus}</span>
                                        ) : null}
                                        <span>last sync: {fmtDateTime(item.lastSyncAt)}</span>
                                    </div>
                                </div>

                                <ZoruSwitch
                                    checked={isActive}
                                    onCheckedChange={(v) =>
                                        handleToggle(item, v === true)
                                    }
                                    disabled={togglePending}
                                    aria-label={`Toggle ${item.name}`}
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[12px]">
                                <ZoruBadge variant="outline" className="gap-1">
                                    <ShieldCheck className="h-3 w-3" />
                                    credentials: ***hidden***
                                </ZoruBadge>
                                {item.webhookUrl ? (
                                    <ZoruBadge variant="outline" className="gap-1 font-mono">
                                        <Webhook className="h-3 w-3" />
                                        <span className="max-w-[220px] truncate">
                                            {item.webhookUrl}
                                        </span>
                                    </ZoruBadge>
                                ) : null}
                            </div>

                            <div className="flex items-center justify-end gap-1 border-t border-zoru-line pt-2">
                                <ZoruButton variant="ghost" size="sm" asChild>
                                    <Link href={`${BASE}/${item._id}/edit`}>
                                        <Edit className="h-4 w-4" /> Edit
                                    </Link>
                                </ZoruButton>
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPendingDelete(item)}
                                >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </ZoruButton>
                            </div>
                        </ZoruCard>
                    );
                })}
            </div>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete integration?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Removing &ldquo;{pendingDelete?.name}&rdquo; will revoke its
                            connection. Any stored credentials will be deleted permanently.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? (
                                <>
                                    <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                                    Deleting…
                                </>
                            ) : (
                                'Delete'
                            )}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
