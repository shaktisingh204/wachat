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
    Globe,
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
import type { BadgeTone } from '@/components/sabcrm/20ui';
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, EmptyState, Field, Input, Separator, useToast } from '@/components/sabcrm/20ui';

type Status = 'pending' | 'verified' | 'failed';

const STATUS_LABEL: Record<Status, string> = {
    verified: 'Verified',
    failed: 'Failed',
    pending: 'Pending',
};

function StatusPill({
    label,
    status,
}: {
    label: string;
    status?: Status;
}) {
    const s: Status = status ?? 'pending';
    const tone: BadgeTone =
        s === 'verified' ? 'success' : s === 'failed' ? 'danger' : 'warning';
    const Icon = s === 'verified' ? CheckCircle2 : s === 'failed' ? AlertTriangle : Clock;
    return (
        <Badge tone={tone} className="inline-flex items-center gap-1">
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label} · {STATUS_LABEL[s]}
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
    const { toast } = useToast();
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
                tone: 'danger',
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
                tone: 'danger',
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
                tone: 'danger',
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
                tone: 'danger',
            });
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        Add a domain
                    </CardTitle>
                    <CardDescription>
                        Enter the apex domain (for example, <code>acme.com</code>). DNS records
                        appear below once it is saved.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                            <Field label="Domain" id="mail-domain-name">
                                <Input
                                    id="mail-domain-name"
                                    value={domainName}
                                    onChange={(e) => setDomainName(e.target.value)}
                                    placeholder="acme.com"
                                    autoComplete="off"
                                    iconLeft={Globe}
                                    required
                                />
                            </Field>
                        </div>
                        <Button
                            type="submit"
                            variant="primary"
                            iconLeft={Plus}
                            loading={submitting}
                            disabled={submitting || !domainName.trim()}
                        >
                            {submitting ? 'Adding…' : 'Add domain'}
                        </Button>
                    </form>
                </CardBody>
            </Card>

            {initialDomains.length === 0 ? (
                <EmptyState
                    icon={Globe}
                    title="No domains yet"
                    description="Add a domain to start receiving mail and provisioning mailboxes."
                />
            ) : (
                <ul className="flex flex-col gap-4">
                    {initialDomains.map((d) => {
                        const id = d._id!;
                        const busy = busyId === id;
                        return (
                            <li key={id}>
                              <Card>
                                <CardHeader>
                                    <CardTitle className="flex flex-wrap items-center gap-2">
                                        <Globe className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                        <span className="font-mono">{d.domain}</span>
                                    </CardTitle>
                                    <CardDescription className="flex flex-wrap gap-2 pt-2">
                                        <StatusPill label="MX" status={d.mxStatus} />
                                        <StatusPill label="SPF" status={d.spfStatus} />
                                        <StatusPill label="DKIM" status={d.dkimStatus} />
                                        <StatusPill label="DMARC" status={d.dmarcStatus} />
                                    </CardDescription>
                                </CardHeader>
                                <CardBody className="flex flex-col gap-3">
                                    <pre className="max-h-48 overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-xs leading-relaxed text-[var(--st-text-secondary)]">
                                        {dnsRecordsFor(d)}
                                    </pre>
                                    <Separator />
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            iconLeft={Copy}
                                            disabled={busy}
                                            onClick={() => handleCopy(d)}
                                        >
                                            Copy DNS records
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            iconLeft={RefreshCw}
                                            loading={busy}
                                            disabled={busy}
                                            onClick={() => handleRecheck(id)}
                                        >
                                            {busy ? 'Checking…' : 'Recheck DNS'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="danger"
                                            size="sm"
                                            iconLeft={Trash2}
                                            disabled={busy}
                                            onClick={() => handleDelete(id, d.domain)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </CardBody>
                              </Card>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
