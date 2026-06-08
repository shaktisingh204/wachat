'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Field,
    Input,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    Badge,
    Alert,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    revokeSabvaultShare,
    shareSabvaultSecret,
} from '@/app/actions/sabvault.actions';
import type { SabvaultSecretDoc } from '@/lib/rust-client/sabvault-secrets';
import type {
    SabvaultGranteeType,
    SabvaultShareDoc,
    SabvaultSharePermission,
} from '@/lib/rust-client/sabvault-shares';

export function ShareDialogClient({
    secret,
    initialShares,
}: {
    secret: SabvaultSecretDoc;
    initialShares: SabvaultShareDoc[];
}) {
    const router = useRouter();
    const { toast } = useToast();
    const [granteeType, setGranteeType] = React.useState<SabvaultGranteeType>('user');
    const [granteeId, setGranteeId] = React.useState('');
    const [permission, setPermission] = React.useState<SabvaultSharePermission>('read');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            if (!secret._id) return;
            const out = await shareSabvaultSecret({
                secretId: secret._id,
                granteeType,
                granteeId: granteeId.trim(),
                permission,
            });
            if (out.error) {
                setError(out.error);
                toast.error(out.error);
                return;
            }
            setGranteeId('');
            toast.success('Access granted');
            router.refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Share failed';
            setError(message);
            toast.error(message);
        } finally {
            setBusy(false);
        }
    }

    async function onRevoke(shareId?: string) {
        if (!shareId) return;
        const out = await revokeSabvaultShare(shareId);
        if (out.error) {
            setError(out.error);
            toast.error(out.error);
        } else {
            toast.success('Access revoked');
            router.refresh();
        }
    }

    return (
        <div className="20ui mx-auto flex max-w-2xl flex-col gap-4 p-6">
            <Link
                href={`/dashboard/sabvault/${secret._id}`}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
                <ArrowLeft size={14} aria-hidden="true" />
                Back to secret
            </Link>

            <PageHeader bordered={false} compact>
                <PageHeaderHeading>
                    <PageTitle>Share {secret.name}</PageTitle>
                    <PageDescription>
                        Grant a teammate or team access. The grantee unlocks with their own master key.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>New grant</CardTitle>
                    <CardDescription>
                        Pick who gets access and what they can do with this secret.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                        <div className="grid grid-cols-3 gap-3">
                            <Field label="Grantee">
                                <Select
                                    value={granteeType}
                                    onValueChange={(v) => setGranteeType(v as SabvaultGranteeType)}
                                >
                                    <SelectTrigger aria-label="Grantee type">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="user">User</SelectItem>
                                        <SelectItem value="team">Team</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="User/Team ID" className="col-span-2" required>
                                <Input
                                    required
                                    value={granteeId}
                                    onChange={(e) => setGranteeId(e.target.value)}
                                    placeholder="ObjectId"
                                    iconLeft={KeyRound}
                                />
                            </Field>
                        </div>
                        <Field label="Permission">
                            <Select
                                value={permission}
                                onValueChange={(v) => setPermission(v as SabvaultSharePermission)}
                            >
                                <SelectTrigger aria-label="Permission level">
                                    <SelectValue placeholder="Permission" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="read">Read (reveal/copy)</SelectItem>
                                    <SelectItem value="use">Use (auto-fill only)</SelectItem>
                                    <SelectItem value="edit">Edit</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        {error ? (
                            <Alert tone="danger" title="Could not share secret">
                                {error}
                            </Alert>
                        ) : null}
                        <Button type="submit" variant="primary" loading={busy} disabled={busy}>
                            {busy ? 'Granting...' : 'Grant access'}
                        </Button>
                    </form>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Active grants</CardTitle>
                    <CardDescription>
                        Everyone who currently has access to this secret.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    {initialShares.length === 0 ? (
                        <EmptyState
                            icon={ShieldCheck}
                            title="No active shares"
                            description="This secret is private. Grant access above to share it with a teammate or team."
                        />
                    ) : (
                        <ul className="flex flex-col divide-y divide-[var(--st-border)]">
                            {initialShares.map((s) => (
                                <li key={s._id} className="flex items-center justify-between py-2.5">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-sm font-medium text-[var(--st-text)]">
                                            {s.granteeType}: <span className="font-mono">{s.granteeId}</span>
                                        </div>
                                        <div className="text-xs text-[var(--st-text-secondary)]">
                                            Granted {new Date(s.grantedAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge tone="accent">{s.permission}</Badge>
                                        <Button variant="outline" size="sm" onClick={() => onRevoke(s._id)}>
                                            Revoke
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
