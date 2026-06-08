'use client';

/** Domains tab — custom domains with verification instructions. */
import React from 'react';
import { Globe, Plus, Trash2 } from 'lucide-react';

import {
    createSabcatalystDomain,
    deleteSabcatalystDomain,
} from '@/app/actions/sabcatalyst.actions';
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
    Input,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import type { SabcatalystDomain } from '@/lib/rust-client/sabcatalyst-domains';

interface Props { projectId: string; initialDomains: SabcatalystDomain[] }

function sslTone(status: string): BadgeTone {
    switch (status) {
        case 'issued':
        case 'active':
            return 'success';
        case 'pending':
            return 'info';
        case 'failed':
            return 'danger';
        default:
            return 'neutral';
    }
}

export function DomainsTab({ projectId, initialDomains }: Props) {
    const [domains, setDomains] = React.useState(initialDomains);
    const [hostname, setHostname] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    async function add() {
        if (!hostname.trim()) return;
        setBusy(true);
        try {
            const d = await createSabcatalystDomain({ projectId, hostname: hostname.trim() });
            setDomains((s) => [d, ...s]);
            setHostname('');
        } finally {
            setBusy(false);
        }
    }

    async function remove(id: string) {
        if (!confirm('Remove this domain?')) return;
        await deleteSabcatalystDomain(id, projectId);
        setDomains((s) => s.filter((x) => x._id !== id));
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Globe size={16} aria-hidden="true" />
                        <CardTitle>Add a custom domain</CardTitle>
                    </div>
                    <CardDescription>
                        Serve your HTTP functions from your own hostname.
                    </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <Field label="Hostname" className="flex-1">
                        <Input
                            value={hostname}
                            onChange={(e) => setHostname(e.target.value)}
                            placeholder="api.example.com"
                        />
                    </Field>
                    <Button
                        variant="primary"
                        iconLeft={Plus}
                        onClick={add}
                        loading={busy}
                        disabled={busy || !hostname.trim()}
                    >
                        Add domain
                    </Button>
                </CardBody>
            </Card>

            {domains.length === 0 ? (
                <Card>
                    <CardBody className="p-6">
                        <EmptyState
                            icon={Globe}
                            title="No custom domains"
                            description="Add one to serve your HTTP functions from your own hostname."
                        />
                    </CardBody>
                </Card>
            ) : (
                <ul className="flex list-none flex-col gap-2 p-0">
                    {domains.map((d) => (
                        <li key={d._id}>
                            <Card>
                                <CardBody className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="flex items-center gap-2 truncate font-mono font-semibold">
                                                    <Globe size={14} aria-hidden="true" />
                                                    {d.hostname}
                                                </h3>
                                                <Badge tone={d.verified ? 'success' : 'warning'}>
                                                    {d.verified ? 'verified' : 'pending'}
                                                </Badge>
                                                <Badge tone={sslTone(d.sslStatus)}>
                                                    ssl: {d.sslStatus}
                                                </Badge>
                                            </div>
                                            {!d.verified ? (
                                                <div className="mt-2 space-y-1 text-xs text-[var(--st-text-secondary)]">
                                                    <p>To verify, add these DNS records:</p>
                                                    <code className="mt-1 block rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-2">
                                                        CNAME {d.hostname} → sabcatalyst.sabnode.io
                                                    </code>
                                                    <code className="block rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-2">
                                                        TXT _sabcatalyst-verify.{d.hostname} → {d._id}
                                                    </code>
                                                </div>
                                            ) : null}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            iconLeft={Trash2}
                                            onClick={() => remove(d._id)}
                                            aria-label={`Remove ${d.hostname}`}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
