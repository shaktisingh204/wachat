'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
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
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { Check,
  Copy,
  LoaderCircle,
  Webhook } from 'lucide-react';

/**
 * CRM Settings — New webhook subscription (Phase 7 foundation).
 *
 * The shared secret is shown EXACTLY ONCE after creation.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    createWebhookSubscription,
    listKnownEvents,
} from '@/app/actions/crm-webhooks.actions';

export default function NewWebhookPage() {
    const router = useRouter();
    const toast = useZoruToast();

    const [name, setName] = React.useState('');
    const [targetUrl, setTargetUrl] = React.useState('');
    const [events, setEvents] = React.useState<readonly string[]>([]);
    const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
    const [submitting, setSubmitting] = React.useState(false);
    const [secret, setSecret] = React.useState<string | null>(null);
    const [copied, setCopied] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
        let mounted = true;
        (async () => {
            const list = await listKnownEvents();
            if (mounted) setEvents(list);
        })();
        return () => {
            mounted = false;
        };
    }, []);

    if (!isMounted) {
        return (
            <div className="flex h-60 items-center justify-center">
                <LoaderCircle className="h-5 w-5 animate-spin text-[var(--st-text-secondary)]" />
            </div>
        );
    }

    const toggle = (e: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(e)) next.delete(e);
            else next.add(e);
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !targetUrl.trim()) {
            toast.toast({
                title: 'Missing fields',
                description: 'Name and target URL are required.',
                variant: 'destructive',
            });
            return;
        }
        if (selected.size === 0) {
            toast.toast({
                title: 'Pick at least one event',
                variant: 'destructive',
            });
            return;
        }
        setSubmitting(true);
        try {
            const res = await createWebhookSubscription({
                name: name.trim(),
                targetUrl: targetUrl.trim(),
                events: Array.from(selected),
            });
            if (!res.ok) {
                toast.toast({
                    title: 'Failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            setSecret(res.secret);
            toast.toast({ title: 'Subscription created — copy the secret now.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopy = async () => {
        if (!secret) return;
        try {
            await navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // ignore
        }
    };

    if (secret) {
        return (
            <div className="flex min-h-full flex-col gap-6">
                <PageHeader>
                    <ZoruPageHeading>
                        <Webhook className="size-5" />
                        <ZoruPageTitle>Subscription created</ZoruPageTitle>
                    </ZoruPageHeading>
                </PageHeader>
                <Alert variant="destructive">
                    <ZoruAlertTitle>Copy the signing secret now</ZoruAlertTitle>
                    <ZoruAlertDescription>
                        This secret is used to verify the{' '}
                        <code className="font-mono">X-Sabnode-Signature</code> HMAC header
                        on every delivery. It will not be shown again.
                    </ZoruAlertDescription>
                </Alert>
                <Card className="p-4">
                    <div className="font-mono text-sm break-all rounded-md bg-[var(--st-bg-muted)] p-3">
                        {secret}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <Button onClick={handleCopy}>
                            {copied ? (
                                <>
                                    <Check className="mr-2 size-4" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="mr-2 size-4" />
                                    Copy
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push('/dashboard/crm/settings/webhooks')}
                        >
                            Done
                        </Button>
                    </div>
                </Card>
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
                        <ZoruBreadcrumbPage>New</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>
            <PageHeader>
                <ZoruPageHeading>
                    <Webhook className="size-5" />
                    <ZoruPageTitle>New webhook subscription</ZoruPageTitle>
                </ZoruPageHeading>
                <ZoruPageDescription>
                    The shared signing secret will be shown once after creation.
                </ZoruPageDescription>
            </PageHeader>

            <form className="space-y-6" onSubmit={handleSubmit}>
                <Card className="space-y-4 p-4">
                    <div>
                        <Label htmlFor="wh-name">Name</Label>
                        <Input
                            id="wh-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={submitting}
                            placeholder="Production CRM events"
                        />
                    </div>
                    <div>
                        <Label htmlFor="wh-url">Target URL</Label>
                        <Input
                            id="wh-url"
                            type="url"
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            disabled={submitting}
                            placeholder="https://example.com/webhooks/sabnode"
                        />
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <Label>Events</Label>
                        <span className="text-sm text-[var(--st-text-secondary)]">
                            {selected.size} selected
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {events.map((ev) => (
                            <label
                                key={ev}
                                className="flex items-center gap-2 text-sm"
                            >
                                <Checkbox
                                    checked={selected.has(ev)}
                                    onCheckedChange={() => toggle(ev)}
                                    disabled={submitting}
                                />
                                <span className="font-mono text-xs">{ev}</span>
                            </label>
                        ))}
                    </div>
                </Card>

                <div className="flex gap-2">
                    <Button type="submit" disabled={submitting}>
                        {submitting && (
                            <LoaderCircle className="mr-2 size-4 animate-spin" />
                        )}
                        Create subscription
                    </Button>
                    <Link href="/dashboard/crm/settings/webhooks">
                        <Button type="button" variant="outline" disabled={submitting}>
                            Cancel
                        </Button>
                    </Link>
                </div>
            </form>
        </div>
    );
}
