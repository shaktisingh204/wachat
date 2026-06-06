'use client';

/**
 * Mailbox accounts — client layer.
 *
 * - Domain filter selector
 * - "New mailbox" form (localPart, displayName, quota slider, password)
 * - Per-row Suspend/Activate toggle, "Open inbox" link, delete
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Plus, Trash2 } from 'lucide-react';

import {
    createMailAccount,
    deleteMailAccount,
    updateMailAccount,
} from '@/app/actions/mailbox.actions';
import type { MailDomainDoc } from '@/lib/rust-client/mail-domains';
import type { MailAccountDoc } from '@/lib/rust-client/mail-accounts';
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Switch, useToast } from '@/components/sabcrm/20ui';

export interface AccountsClientProps {
    domains: MailDomainDoc[];
    initialAccounts: MailAccountDoc[];
}

export function AccountsClient({ domains, initialAccounts }: AccountsClientProps) {
    const router = useRouter();
    const { toast } = useToast();

    const [filterDomain, setFilterDomain] = React.useState<string>('__all');
    const [submitting, setSubmitting] = React.useState(false);
    const [busyId, setBusyId] = React.useState<string | null>(null);

    // Form fields
    const [domainId, setDomainId] = React.useState<string>(domains[0]?._id ?? '');
    const [localPart, setLocalPart] = React.useState('');
    const [displayName, setDisplayName] = React.useState('');
    const [quotaMb, setQuotaMb] = React.useState(2048);
    const [password, setPassword] = React.useState('');

    const accounts = React.useMemo(() => {
        if (filterDomain === '__all') return initialAccounts;
        return initialAccounts.filter((a) => a.domainId === filterDomain);
    }, [initialAccounts, filterDomain]);

    const domainOf = (id: string) => domains.find((d) => d._id === id)?.domain ?? '?';

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!domainId || !localPart.trim()) return;
        setSubmitting(true);
        const res = await createMailAccount({
            domainId,
            localPart: localPart.trim(),
            displayName: displayName.trim() || undefined,
            quotaMb,
            password: password || undefined,
        });
        setSubmitting(false);
        if (!res.ok) {
            toast({
                title: 'Could not create mailbox',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        toast({
            title: 'Mailbox created',
            description: `${localPart}@${domainOf(domainId)} is ready.`,
        });
        setLocalPart('');
        setDisplayName('');
        setPassword('');
        router.refresh();
    };

    const handleToggleStatus = async (acc: MailAccountDoc, suspend: boolean) => {
        const id = acc._id!;
        setBusyId(id);
        const res = await updateMailAccount(id, {
            status: suspend ? 'suspended' : 'active',
        });
        setBusyId(null);
        if (!res.ok) {
            toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: suspend ? 'Suspended' : 'Activated' });
        router.refresh();
    };

    const handleDelete = async (acc: MailAccountDoc) => {
        const email = acc.emailAddress ?? `${acc.localPart}@${domainOf(acc.domainId)}`;
        if (!window.confirm(`Delete ${email}? This cannot be undone.`)) return;
        setBusyId(acc._id!);
        const res = await deleteMailAccount(acc._id!);
        setBusyId(null);
        if (!res.ok) {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Mailbox deleted' });
        router.refresh();
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>New mailbox</CardTitle>
                    <CardDescription>
                        Pick a domain, choose a local part, set a quota and (optional) password.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label>Domain</Label>
                            <Select value={domainId} onValueChange={setDomainId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select domain" />
                                </SelectTrigger>
                                <SelectContent>
                                    {domains.map((d) => (
                                        <SelectItem key={d._id} value={d._id!}>
                                            {d.domain}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="mail-acct-local">Local part</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="mail-acct-local"
                                    value={localPart}
                                    onChange={(e) => setLocalPart(e.target.value)}
                                    placeholder="hello"
                                    autoComplete="off"
                                    required
                                />
                                <span className="text-sm text-[var(--st-text-secondary)]">
                                    @{domainOf(domainId)}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="mail-acct-display">Display name</Label>
                            <Input
                                id="mail-acct-display"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Hello Team"
                                autoComplete="off"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="mail-acct-password">Password (optional)</Label>
                            <Input
                                id="mail-acct-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Auto-generated if blank"
                                autoComplete="new-password"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor="mail-acct-quota">
                                Quota: {quotaMb >= 1024 ? `${(quotaMb / 1024).toFixed(1)} GB` : `${quotaMb} MB`}
                            </Label>
                            <input
                                id="mail-acct-quota"
                                type="range"
                                min={256}
                                max={50 * 1024}
                                step={256}
                                value={quotaMb}
                                onChange={(e) => setQuotaMb(Number(e.target.value))}
                                className="w-full accent-[var(--st-accent)]"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Button type="submit" disabled={submitting || !domainId || !localPart.trim()}>
                                <Plus className="mr-2 h-4 w-4" />
                                {submitting ? 'Creating…' : 'Create mailbox'}
                            </Button>
                        </div>
                    </form>
                </CardBody>
            </Card>

            <div className="flex items-center gap-3">
                <Label className="text-sm">Filter by domain</Label>
                <Select value={filterDomain} onValueChange={setFilterDomain}>
                    <SelectTrigger className="w-64">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all">All domains</SelectItem>
                        {domains.map((d) => (
                            <SelectItem key={d._id} value={d._id!}>
                                {d.domain}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {accounts.length === 0 ? (
                <EmptyState
                    icon={<Mail className="h-10 w-10" />}
                    title="No mailboxes on this domain"
                    description="Create your first mailbox above."
                />
            ) : (
                <div className="grid gap-3">
                    {accounts.map((a) => {
                        const id = a._id!;
                        const email = a.emailAddress ?? `${a.localPart}@${domainOf(a.domainId)}`;
                        const active = (a.status ?? 'active') === 'active';
                        const busy = busyId === id;
                        return (
                            <Card key={id}>
                                <CardBody className="flex flex-wrap items-center justify-between gap-3 p-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-[var(--st-text-secondary)]" />
                                            <span className="font-medium">{a.displayName ?? email}</span>
                                            <Badge variant={active ? 'default' : 'secondary'}>
                                                {a.status ?? 'active'}
                                            </Badge>
                                        </div>
                                        <div className="truncate text-sm text-[var(--st-text-secondary)]">{email}</div>
                                        {a.quotaMb ? (
                                            <div className="text-xs text-[var(--st-text-secondary)]">
                                                Quota: {a.quotaMb} MB
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`active-${id}`} className="text-xs">
                                                Active
                                            </Label>
                                            <Switch
                                                id={`active-${id}`}
                                                checked={active}
                                                disabled={busy}
                                                onCheckedChange={(v) => handleToggleStatus(a, !v)}
                                            />
                                        </div>
                                        <Separator orientation="vertical" className="h-6" />
                                        <Button asChild size="sm" variant="outline">
                                            <Link href={`/dashboard/mailbox/${id}/inbox`}>
                                                Open inbox
                                            </Link>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            disabled={busy}
                                            onClick={() => handleDelete(a)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
