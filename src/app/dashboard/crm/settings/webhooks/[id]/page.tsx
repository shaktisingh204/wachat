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
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useParams,
  useRouter } from 'next/navigation';
import { LoaderCircle,
  Pause,
  Play,
  Trash2,
  Webhook } from 'lucide-react';

/**
 * CRM Settings — Webhook subscription detail (Phase 7 foundation).
 *
 * Allows pausing/resuming, editing the target URL/events, and deleting a
 * subscription. The signing secret is never shown again after creation.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    deleteWebhookSubscription,
    getWebhookSubscription,
    listKnownEvents,
    updateWebhookSubscription,
    type CrmWebhookRow,
} from '@/app/actions/crm-webhooks.actions';

export default function CrmWebhookDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id ?? '';
    const toast = useZoruToast();

    const [row, setRow] = React.useState<CrmWebhookRow | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [eventsCatalog, setEventsCatalog] = React.useState<readonly string[]>([]);

    const [name, setName] = React.useState('');
    const [targetUrl, setTargetUrl] = React.useState('');
    const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            const [r, evs] = await Promise.all([
                getWebhookSubscription(id),
                listKnownEvents(),
            ]);
            if (!mounted) return;
            setRow(r);
            setEventsCatalog(evs);
            if (r) {
                setName(r.name);
                setTargetUrl(r.targetUrl);
                setSelected(new Set(r.events));
            }
            setLoading(false);
        })();
        return () => {
            mounted = false;
        };
    }, [id]);

    const toggleEvent = (ev: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(ev)) next.delete(ev);
            else next.add(ev);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await updateWebhookSubscription(id, {
                name,
                targetUrl,
                events: Array.from(selected),
            });
            if (!res.ok) {
                toast.toast({
                    title: 'Save failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            toast.toast({ title: 'Saved' });
            const refreshed = await getWebhookSubscription(id);
            setRow(refreshed);
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async () => {
        if (!row) return;
        setSaving(true);
        try {
            const nextStatus = row.status === 'active' ? 'paused' : 'active';
            const res = await updateWebhookSubscription(id, { status: nextStatus });
            if (!res.ok) {
                toast.toast({
                    title: 'Failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            const refreshed = await getWebhookSubscription(id);
            setRow(refreshed);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        const res = await deleteWebhookSubscription(id);
        if (!res.ok) {
            toast.toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
            setDeleting(false);
            return;
        }
        toast.toast({ title: 'Subscription deleted' });
        router.push('/dashboard/crm/settings/webhooks');
    };

    if (loading) {
        return (
            <div className="flex min-h-full flex-col gap-4 p-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    if (!row) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Subscription not found.{' '}
                <Link
                    href="/dashboard/crm/settings/webhooks"
                    className="underline"
                >
                    Back to list
                </Link>
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/crm/settings/webhooks">
                            Webhooks
                        </ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>{row.name}</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <ZoruPageHeading>
                            <Webhook className="size-5" />
                            <ZoruPageTitle>{row.name}</ZoruPageTitle>
                            <Badge
                                variant={row.status === 'active' ? 'default' : 'secondary'}
                            >
                                {row.status}
                            </Badge>
                        </ZoruPageHeading>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={toggleStatus} disabled={saving}>
                            {row.status === 'active' ? (
                                <>
                                    <Pause className="mr-2 size-4" />
                                    Pause
                                </>
                            ) : (
                                <>
                                    <Play className="mr-2 size-4" />
                                    Resume
                                </>
                            )}
                        </Button>
                        <ZoruAlertDialog>
                            <ZoruAlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={deleting}>
                                    <Trash2 className="mr-2 size-4" />
                                    Delete
                                </Button>
                            </ZoruAlertDialogTrigger>
                            <ZoruAlertDialogContent>
                                <ZoruAlertDialogHeader>
                                    <ZoruAlertDialogTitle>Delete subscription?</ZoruAlertDialogTitle>
                                    <ZoruAlertDialogDescription>
                                        All future events that would have been delivered to{' '}
                                        <code className="font-mono">{row.targetUrl}</code> will be
                                        dropped. This cannot be undone.
                                    </ZoruAlertDialogDescription>
                                </ZoruAlertDialogHeader>
                                <ZoruAlertDialogFooter>
                                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                    <ZoruAlertDialogAction onClick={handleDelete}>
                                        Delete
                                    </ZoruAlertDialogAction>
                                </ZoruAlertDialogFooter>
                            </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
                    </div>
                </div>
            </PageHeader>

            <Card className="space-y-4 p-4">
                <div>
                    <Label htmlFor="wh-name">Name</Label>
                    <Input
                        id="wh-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={saving}
                    />
                </div>
                <div>
                    <Label htmlFor="wh-url">Target URL</Label>
                    <Input
                        id="wh-url"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        disabled={saving}
                    />
                </div>
                <div className="text-xs text-muted-foreground">
                    {row.failureCount > 0 && (
                        <span>
                            {row.failureCount} consecutive failure
                            {row.failureCount === 1 ? '' : 's'}. Auto-paused at 10.
                        </span>
                    )}
                </div>
            </Card>

            <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Events</Label>
                    <span className="text-sm text-muted-foreground">
                        {selected.size} selected
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {eventsCatalog.map((ev) => (
                        <label key={ev} className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={selected.has(ev)}
                                onCheckedChange={() => toggleEvent(ev)}
                                disabled={saving}
                            />
                            <span className="font-mono text-xs">{ev}</span>
                        </label>
                    ))}
                </div>
            </Card>

            <div>
                <Button onClick={handleSave} disabled={saving}>
                    {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
                    Save changes
                </Button>
            </div>
        </div>
    );
}
