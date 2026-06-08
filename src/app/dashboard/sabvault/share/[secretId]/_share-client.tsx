'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, ShieldCheck, UserPlus, Users, User, Ban } from 'lucide-react';

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
    Avatar,
    Alert,
    EmptyState,
    Separator,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    useToast,
    type BadgeTone,
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

const PERMISSION_TONE: Record<string, BadgeTone> = {
    read: 'info',
    use: 'neutral',
    edit: 'accent',
};

const PERMISSION_LABEL: Record<string, string> = {
    read: 'Read',
    use: 'Use',
    edit: 'Edit',
};

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
        <main className="20ui mx-auto flex max-w-2xl flex-col gap-5 p-6">
            <Link
                href={`/dashboard/sabvault/${secret._id}`}
                className="inline-flex w-fit items-center gap-1.5 rounded-[var(--st-radius)] text-sm text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
            >
                <ArrowLeft size={14} aria-hidden="true" />
                Back to secret
            </Link>

            <PageHeader bordered={false} compact>
                <PageHeaderHeading>
                    <PageEyebrow>Share secret</PageEyebrow>
                    <PageTitle>{secret.name}</PageTitle>
                    <PageDescription>
                        Grant a teammate or team access. Each grantee unlocks with their own master key.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <UserPlus className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                        New grant
                    </CardTitle>
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

            <Card padding="none">
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                            Active grants
                        </CardTitle>
                        <Badge tone={initialShares.length ? 'accent' : 'neutral'}>
                            {initialShares.length}
                        </Badge>
                    </div>
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
                                <li key={s._id} className="flex items-center justify-between gap-3 py-2.5">
                                    <div className="flex min-w-0 items-center gap-3">
                                        {s.granteeType === 'team' ? (
                                            <span
                                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                                                aria-hidden="true"
                                            >
                                                <Users className="h-4 w-4" />
                                            </span>
                                        ) : (
                                            <Avatar name={s.granteeId} shape="round" size="sm" />
                                        )}
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5 truncate text-sm font-medium text-[var(--st-text)]">
                                                {s.granteeType === 'team' ? (
                                                    <Users className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                                                ) : (
                                                    <User className="h-3.5 w-3.5 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                                                )}
                                                <span className="truncate font-mono">{s.granteeId}</span>
                                            </div>
                                            <div className="text-xs tabular-nums text-[var(--st-text-tertiary)]">
                                                Granted {new Date(s.grantedAt).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <Badge tone={PERMISSION_TONE[s.permission] ?? 'accent'} kind="outline">
                                            {PERMISSION_LABEL[s.permission] ?? s.permission}
                                        </Badge>
                                        <Button variant="ghost" size="sm" iconLeft={Ban} onClick={() => onRevoke(s._id)}>
                                            Revoke
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </main>
    );
}
