'use client';

/**
 * "Share" dialog for a SabFiles node — two modes:
 *  • People   — add/remove collaborators (viewer/editor) by email, with
 *               workspace-member suggestions; mirrors the CRM invite flow.
 *  • Link     — create / copy / revoke a public share link.
 *
 * Built entirely on 20ui primitives. Lives in `views/` so it is not re-exported
 * by the 20ui barrel (no self-cycle); it imports 20ui via the barrel.
 */
import * as React from 'react';
import { Check, Copy, Link2, Trash2, UserPlus, X } from 'lucide-react';

import {
    Avatar,
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Field,
    IconButton,
    Input,
    SegmentedControl,
    useToast,
} from '@/components/sabcrm/20ui';

import {
    addFileMember,
    createShare,
    listFileMembers,
    listShareablePeople,
    removeFileMember,
    revokeShare,
} from '@/app/actions/sabfiles.actions';

import type { SabfilesNode, SabFileMember, SabFileRole } from './types';

export interface SabFilePeopleShareDialogProps {
    node: SabfilesNode | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    parentId: string | null;
    /** Called after the membership or link changes so the caller can refresh. */
    onChanged?: () => void;
}

type Tab = 'people' | 'link';

export function SabFilePeopleShareDialog({
    node,
    open,
    onOpenChange,
    parentId,
    onChanged,
}: SabFilePeopleShareDialogProps): React.JSX.Element {
    const { toast } = useToast();
    const [tab, setTab] = React.useState<Tab>('people');
    const [members, setMembers] = React.useState<SabFileMember[]>([]);
    const [people, setPeople] = React.useState<{ userId: string; name: string; email: string; image?: string }[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [email, setEmail] = React.useState('');
    const [role, setRole] = React.useState<SabFileRole>('viewer');
    const [busy, setBusy] = React.useState(false);

    const [shareToken, setShareToken] = React.useState<string | null>(node?.shareToken ?? null);

    // Load members + suggestions whenever the dialog opens for a node.
    React.useEffect(() => {
        if (!open || !node) return;
        setTab('people');
        setEmail('');
        setRole('viewer');
        setShareToken(node.shareToken ?? null);
        let cancelled = false;
        setLoading(true);
        void Promise.all([listFileMembers(node.id), listShareablePeople()]).then(([m, p]) => {
            if (cancelled) return;
            setMembers(m.members);
            setPeople(p.people);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [open, node]);

    const refreshMembers = React.useCallback(async () => {
        if (!node) return;
        const m = await listFileMembers(node.id);
        setMembers(m.members);
        onChanged?.();
    }, [node, onChanged]);

    const handleAdd = React.useCallback(async () => {
        if (!node) return;
        const value = email.trim();
        if (!value) return;
        setBusy(true);
        const res = await addFileMember(node.id, value, role, parentId);
        setBusy(false);
        if ('error' in res) {
            toast.error({ title: 'Could not share', description: res.error });
            return;
        }
        setEmail('');
        toast.success({ title: 'Shared', description: `${value} can now ${role === 'editor' ? 'edit' : 'view'} this.` });
        void refreshMembers();
    }, [node, email, role, parentId, refreshMembers, toast]);

    const handleRemove = React.useCallback(
        async (m: SabFileMember) => {
            if (!node) return;
            const res = await removeFileMember(node.id, m.userId, parentId);
            if ('error' in res) {
                toast.error({ title: 'Could not remove', description: res.error });
                return;
            }
            setMembers((curr) => curr.filter((x) => x.userId !== m.userId));
            onChanged?.();
        },
        [node, parentId, onChanged, toast],
    );

    const shareUrl = shareToken
        ? typeof window !== 'undefined'
            ? `${window.location.origin}/share/${shareToken}`
            : `/share/${shareToken}`
        : '';

    const handleCreateLink = React.useCallback(async () => {
        if (!node) return;
        setBusy(true);
        const res = await createShare(node.id, { download_enabled: true }, parentId);
        setBusy(false);
        if ('error' in res) {
            toast.error({ title: 'Could not create link', description: res.error });
            return;
        }
        setShareToken(res.token);
        onChanged?.();
        toast.success('Public link created');
    }, [node, parentId, onChanged, toast]);

    const handleRevokeLink = React.useCallback(async () => {
        if (!node) return;
        setBusy(true);
        const res = await revokeShare(node.id, parentId);
        setBusy(false);
        if ('error' in res) {
            toast.error({ title: 'Could not revoke link', description: res.error });
            return;
        }
        setShareToken(null);
        onChanged?.();
        toast.success('Public link revoked');
    }, [node, parentId, onChanged, toast]);

    const copyLink = React.useCallback(() => {
        if (!shareUrl) return;
        navigator.clipboard?.writeText(shareUrl).then(
            () => toast.success('Link copied'),
            () => toast.error('Copy failed'),
        );
    }, [shareUrl, toast]);

    const suggestions = people.filter(
        (p) => !members.some((m) => m.userId === p.userId),
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{node ? `Share “${node.name}”` : 'Share'}</DialogTitle>
                    <DialogDescription>
                        Invite people from your workspace or create a public link.
                    </DialogDescription>
                </DialogHeader>

                <SegmentedControl<Tab>
                    items={[
                        { value: 'people', label: 'People', icon: UserPlus },
                        { value: 'link', label: 'Public link', icon: Link2 },
                    ]}
                    value={tab}
                    onChange={setTab}
                    fullWidth
                    aria-label="Share mode"
                />

                {tab === 'people' ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Field label="Add by email">
                                    <Input
                                        type="email"
                                        list="sabfiles-share-people"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="name@company.com"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') void handleAdd();
                                        }}
                                    />
                                    <datalist id="sabfiles-share-people">
                                        {suggestions.map((p) => (
                                            <option key={p.userId} value={p.email}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </datalist>
                                </Field>
                            </div>
                            <SegmentedControl<SabFileRole>
                                items={[
                                    { value: 'viewer', label: 'Viewer' },
                                    { value: 'editor', label: 'Editor' },
                                ]}
                                value={role}
                                onChange={setRole}
                                size="sm"
                                aria-label="Access level"
                            />
                            <Button variant="primary" onClick={handleAdd} loading={busy} disabled={!email.trim()}>
                                Add
                            </Button>
                        </div>

                        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                            {loading ? (
                                <li className="py-4 text-center text-sm text-[var(--st-text-secondary)]">
                                    Loading…
                                </li>
                            ) : (
                                members.map((m) => (
                                    <li
                                        key={m.userId}
                                        className="flex items-center gap-2 rounded-[var(--st-radius)] px-1 py-1.5"
                                    >
                                        <Avatar name={m.name || m.email} src={m.image} size="sm" shape="round" />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm text-[var(--st-text)]">{m.name || m.email}</div>
                                            <div className="truncate text-xs text-[var(--st-text-tertiary)]">{m.email}</div>
                                        </div>
                                        <Badge tone="neutral" kind="soft">
                                            {m.isOwner ? 'Owner' : m.role}
                                        </Badge>
                                        {!m.isOwner ? (
                                            <IconButton
                                                label={`Remove ${m.name || m.email}`}
                                                icon={X}
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void handleRemove(m)}
                                            />
                                        ) : null}
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {shareToken ? (
                            <>
                                <Field label="Anyone with the link">
                                    <div className="flex items-center gap-2">
                                        <Input readOnly value={shareUrl} className="flex-1" />
                                        <IconButton label="Copy link" icon={Copy} variant="outline" onClick={copyLink} />
                                    </div>
                                </Field>
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-sm text-[var(--st-status-ok,var(--st-text-secondary))]">
                                        <Check size={14} aria-hidden="true" /> Public link is active
                                    </span>
                                    <Button
                                        variant="ghost"
                                        iconLeft={Trash2}
                                        onClick={handleRevokeLink}
                                        loading={busy}
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-start gap-2">
                                <p className="text-sm text-[var(--st-text-secondary)]">
                                    Create a public link anyone can open — no account required.
                                </p>
                                <Button variant="primary" iconLeft={Link2} onClick={handleCreateLink} loading={busy}>
                                    Create public link
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
