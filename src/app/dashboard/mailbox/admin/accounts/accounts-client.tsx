'use client';

/**
 * Mailbox accounts - client layer.
 *
 * - Domain filter selector
 * - "New mailbox" form (localPart, displayName, quota slider, password)
 * - Per-row Suspend/Activate toggle, "Open inbox" link, delete
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Plus, Trash2 } from 'lucide-react';

import {
    createMailAccount,
    deleteMailAccount,
    updateMailAccount,
} from '@/app/actions/mailbox.actions';
import type { MailDomainDoc } from '@/lib/rust-client/mail-domains';
import type { MailAccountDoc } from '@/lib/rust-client/mail-accounts';
import {
    Badge,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    IconButton,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Slider,
    Switch,
    useToast,
} from '@/components/sabcrm/20ui';

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

    const quotaLabel = quotaMb >= 1024 ? `${(quotaMb / 1024).toFixed(1)} GB` : `${quotaMb} MB`;

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
                tone: 'danger',
            });
            return;
        }
        toast({
            title: 'Mailbox created',
            description: `${localPart}@${domainOf(domainId)} is ready.`,
            tone: 'success',
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
            toast({ title: 'Update failed', description: res.error, tone: 'danger' });
            return;
        }
        toast({ title: suspend ? 'Suspended' : 'Activated', tone: 'success' });
        router.refresh();
    };

    const handleDelete = async (acc: MailAccountDoc) => {
        const email = acc.emailAddress ?? `${acc.localPart}@${domainOf(acc.domainId)}`;
        if (!window.confirm(`Delete ${email}? This cannot be undone.`)) return;
        setBusyId(acc._id!);
        const res = await deleteMailAccount(acc._id!);
        setBusyId(null);
        if (!res.ok) {
            toast({ title: 'Delete failed', description: res.error, tone: 'danger' });
            return;
        }
        toast({ title: 'Mailbox deleted', tone: 'success' });
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
                        <Field label="Domain">
                            <Select value={domainId} onValueChange={setDomainId}>
                                <SelectTrigger aria-label="Domain">
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
                        </Field>
                        <Field label="Local part">
                            <Input
                                value={localPart}
                                onChange={(e) => setLocalPart(e.target.value)}
                                placeholder="hello"
                                autoComplete="off"
                                suffix={`@${domainOf(domainId)}`}
                                required
                            />
                        </Field>
                        <Field label="Display name">
                            <Input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Hello Team"
                                autoComplete="off"
                            />
                        </Field>
                        <Field label="Password (optional)" help="Auto-generated if left blank.">
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Auto-generated if blank"
                                autoComplete="new-password"
                            />
                        </Field>
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                            <Label htmlFor="mail-acct-quota">Quota: {quotaLabel}</Label>
                            <Slider
                                id="mail-acct-quota"
                                min={256}
                                max={50 * 1024}
                                step={256}
                                value={quotaMb}
                                onValueChange={(v) => setQuotaMb(Number(v))}
                                ariaLabel={`Quota: ${quotaLabel}`}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Button
                                type="submit"
                                variant="primary"
                                iconLeft={Plus}
                                loading={submitting}
                                disabled={submitting || !domainId || !localPart.trim()}
                            >
                                {submitting ? 'Creating...' : 'Create mailbox'}
                            </Button>
                        </div>
                    </form>
                </CardBody>
            </Card>

            <div className="flex items-center gap-3">
                <Label htmlFor="mail-filter-domain" className="text-sm">
                    Filter by domain
                </Label>
                <Select value={filterDomain} onValueChange={setFilterDomain}>
                    <SelectTrigger id="mail-filter-domain" aria-label="Filter by domain" className="w-64">
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
                    icon={Mail}
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
                                            <Mail className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                            <span className="font-medium">{a.displayName ?? email}</span>
                                            <Badge tone={active ? 'success' : 'neutral'}>
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
                                        <Switch
                                            checked={active}
                                            disabled={busy}
                                            onCheckedChange={(v) => handleToggleStatus(a, !v)}
                                            label="Active"
                                            aria-label={`Active: ${email}`}
                                        />
                                        <Separator orientation="vertical" className="h-6" />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => router.push(`/dashboard/mailbox/${id}/inbox`)}
                                        >
                                            Open inbox
                                        </Button>
                                        <IconButton
                                            label={`Delete ${email}`}
                                            icon={Trash2}
                                            variant="danger"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() => handleDelete(a)}
                                        />
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
