'use client';

/** Domains tab — custom domains with verification instructions. */
import React from 'react';

import {
    createSabcatalystDomain,
    deleteSabcatalystDomain,
} from '@/app/actions/sabcatalyst.actions';
import {
    Button,
    Card,
    Input,
    Label,
    EmptyState,
    Badge,
} from '@/components/sabcrm/20ui/compat';
import type { SabcatalystDomain } from '@/lib/rust-client/sabcatalyst-domains';

interface Props { projectId: string; initialDomains: SabcatalystDomain[] }

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
            <Card className="p-4 flex items-end gap-3">
                <div className="flex-1">
                    <Label htmlFor="host">Hostname</Label>
                    <Input
                        id="host"
                        value={hostname}
                        onChange={(e) => setHostname(e.target.value)}
                        placeholder="api.example.com"
                    />
                </div>
                <Button onClick={add} disabled={busy || !hostname.trim()}>Add</Button>
            </Card>

            {domains.length === 0 ? (
                <EmptyState title="No custom domains" description="Add one to serve your HTTP functions from your own hostname." />
            ) : (
                <div className="space-y-2">
                    {domains.map((d) => (
                        <Card key={d._id} className="p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold font-mono">{d.hostname}</h3>
                                        <Badge variant={d.verified ? 'default' : 'secondary'}>
                                            {d.verified ? 'verified' : 'pending'}
                                        </Badge>
                                        <Badge variant="outline">ssl: {d.sslStatus}</Badge>
                                    </div>
                                    {!d.verified ? (
                                        <div className="text-xs text-[var(--st-text-secondary)] mt-2 space-y-1">
                                            <p>To verify, add these DNS records:</p>
                                            <code className="block bg-[var(--st-bg-muted)] p-2 rounded mt-1">
                                                CNAME {d.hostname} → sabcatalyst.sabnode.io
                                            </code>
                                            <code className="block bg-[var(--st-bg-muted)] p-2 rounded">
                                                TXT _sabcatalyst-verify.{d.hostname} → {d._id}
                                            </code>
                                        </div>
                                    ) : null}
                                </div>
                                <Button variant="destructive" onClick={() => remove(d._id)}>
                                    Remove
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
