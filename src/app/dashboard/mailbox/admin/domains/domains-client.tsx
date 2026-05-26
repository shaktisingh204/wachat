'use client';

/**
 * Domain admin — client interactive layer.
 *
 * - "Add domain" form
 * - One card per domain with verification pills (MX / DKIM / SPF / DMARC)
 * - "Copy DNS records" + "Recheck DNS" actions
 *
 * All persistence goes through `mailbox.actions.ts` (server actions).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Copy,
    Plus,
    RefreshCw,
    Trash2,
} from 'lucide-react';

import {
    createMailDomain,
    deleteMailDomain,
    recheckMailDomainDns,
} from '@/app/actions/mailbox.actions';
import type { MailDomainDoc } from '@/lib/rust-client/mail-domains';
import {
    Badge,
    Button,
    Card,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
    EmptyState,
    Input,
    Label,
    Separator,
    useZoruToast,
} from '@/components/zoruui';

type Status = 'pending' | 'verified' | 'failed';

function StatusPill({
    label,
    status,
}: {
    label: string;
    status?: Status;
}) {
    const s: Status = status ?? 'pending';
    const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
        s === 'verified' ? 'default' : s === 'failed' ? 'destructive' : 'secondary';
    const Icon = s === 'verified' ? CheckCircle2 : s === 'failed' ? AlertTriangle : Clock;
    return (
        <Badge variant={variant} className="inline-flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {label}: {s}
        </Badge>
    );
}

function dnsRecordsFor(domain: MailDomainDoc): string {
    const d = domain.domain;
    const selector = domain.dkimSelector ?? 'sabnode';
    return [
        '# MX',
        `${d}.\tIN\tMX\t10 mx.sabnode.cloud.`,
        '',
        '# SPF',
        `${d}.\tIN\tTXT\t"v=spf1 include:sabnode.cloud ~all"`,
        '',
        '# DKIM',
        `${selector}._domainkey.${d}.\tIN\tTXT\t"v=DKIM1; k=rsa; p=${domain.dkimPublicKey ?? '<pending>'}"`,
        '',
        '# DMARC',
        `_dmarc.${d}.\tIN\tTXT\t"v=DMARC1; p=quarantine; rua=mailto:dmarc@${d}"`,
    ].join('\n');
}

export interface DomainsClientProps {
    initialDomains: MailDomainDoc[];
}

export function DomainsClient({ initialDomains }: DomainsClientProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [domainName, setDomainName] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [busyId, setBusyId] = React.useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const v = domainName.trim().toLowerCase();
        if (!v) return;
        setSubmitting(true);
        const res = await createMailDomain({ domain: v });
        setSubmitting(false);
        if (!res.ok) {
            toast({
                title: 'Could not add domain',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        toast({
            title: 'Domain added',
            description: `${v} is pending DNS verification.`,
        });
        setDomainName('');
        router.refresh();
    };

    const handleRecheck = async (id: string) => {
        setBusyId(id);
        const res = await recheckMailDomainDns(id);
        setBusyId(null);
        if (!res.ok) {
            toast({
                title: 'Recheck failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        const v = res.verification;
        toast({
            title: 'DNS recheck queued',
            description: `MX=${v.mx} SPF=${v.spf} DKIM=${v.dkim} DMARC=${v.dmarc}`,
        });
        router.refresh();
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Remove ${name}? Existing mailboxes will be archived.`)) return;
        setBusyId(id);
        const res = await deleteMailDomain(id);
        setBusyId(null);
        if (!res.ok) {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        toast({ title: 'Domain removed' });
        router.refresh();
    };

    const handleCopy = async (domain: MailDomainDoc) => {
        try {
            await navigator.clipboard.writeText(dnsRecordsFor(domain));
            toast({
                title: 'DNS records copied',
                description: 'Paste them into your DNS host.',
            });
        } catch {
            toast({
                title: 'Copy failed',
                description: 'Clipboard not available in this browser.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Add a domain</ZoruCardTitle>
                    <ZoruCardDescription>
                        Enter the apex domain (e.g. <code>acme.com</code>). DNS records will
                        appear below once it&apos;s saved.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <Label htmlFor="mail-domain-name">Domain</Label>
                            <Input
                                id="mail-domain-name"
                                value={domainName}
                                onChange={(e) => setDomainName(e.target.value)}
                                placeholder="acme.com"
                                autoComplete="off"
                                required
                            />
                        </div>
                        <Button type="submit" disabled={submitting || !domainName.trim()}>
                            <Plus className="mr-2 h-4 w-4" />
                            {submitting ? 'Adding…' : 'Add domain'}
                        </Button>
                    </form>
                </ZoruCardContent>
            </Card>

            {initialDomains.length === 0 ? (
                <EmptyState
                    title="No domains yet"
                    description="Add a domain to start receiving mail."
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {initialDomains.map((d) => {
                        const id = d._id!;
                        const busy = busyId === id;
                        return (
                            <Card key={id}>
                                <ZoruCardHeader>
                                    <ZoruCardTitle className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono">{d.domain}</span>
                                    </ZoruCardTitle>
                                    <ZoruCardDescription className="flex flex-wrap gap-2 pt-2">
                                        <StatusPill label="MX" status={d.mxStatus} />
                                        <StatusPill label="SPF" status={d.spfStatus} />
                                        <StatusPill label="DKIM" status={d.dkimStatus} />
                                        <StatusPill label="DMARC" status={d.dmarcStatus} />
                                    </ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent className="flex flex-col gap-3">
                                    <pre className="max-h-48 overflow-auto rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-xs text-zoru-ink-muted">
                                        {dnsRecordsFor(d)}
                                    </pre>
                                    <Separator />
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() => handleCopy(d)}
                                        >
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy DNS records
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() => handleRecheck(id)}
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            {busy ? 'Checking…' : 'Recheck DNS'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            disabled={busy}
                                            onClick={() => handleDelete(id, d.domain)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove
                                        </Button>
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
