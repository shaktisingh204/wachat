'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Lock,
    LockKeyhole,
    StickyNote,
    CreditCard,
    IdCard,
    KeyRound,
    Wifi,
    Server,
    KeySquare,
    ChevronRight,
    Folder,
    FolderOpen,
    ShieldCheck,
    Activity,
    Eye,
} from 'lucide-react';

import {
    Button,
    Card,
    SearchInput,
    Badge,
    Callout,
    EmptyState,
    ScrollArea,
    Separator,
} from '@/components/sabcrm/20ui';
import type { SabvaultFolderDoc } from '@/lib/rust-client/sabvault-folders';
import type { SabvaultSecretDoc } from '@/lib/rust-client/sabvault-secrets';

import { useVaultKey } from './vault-key-context';
import type { SabvaultUserKeyRecord } from '@/app/actions/sabvault.actions';
import { CreateSecretDialog } from './create-secret-dialog';

const KIND_ICON: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
    login: KeyRound,
    note: StickyNote,
    card: CreditCard,
    identity: IdCard,
    key: KeySquare,
    wifi: Wifi,
    server: Server,
};

/**
 * Main vault shell: folder rail, secret list, and an unlock/setup banner.
 * Surfaces a "needs unlock" affordance when the in-memory key is missing.
 */
export function VaultShell({
    initialFolders,
    initialSecrets,
    keyRecord,
    selectedFolderId,
    search,
}: {
    initialFolders: SabvaultFolderDoc[];
    initialSecrets: SabvaultSecretDoc[];
    keyRecord: SabvaultUserKeyRecord | null;
    selectedFolderId: string | null;
    search: string;
}) {
    const router = useRouter();
    const { isUnlocked } = useVaultKey();
    const [query, setQuery] = React.useState(search);

    function applySearch(e: React.FormEvent) {
        e.preventDefault();
        const sp = new URLSearchParams();
        if (query.trim()) sp.set('q', query.trim());
        if (selectedFolderId) sp.set('folder', selectedFolderId);
        router.push(`/dashboard/sabvault${sp.toString() ? `?${sp.toString()}` : ''}`);
    }

    return (
        <div className="20ui flex h-full min-h-[calc(100vh-4rem)] gap-4 p-4">
            {/* Folder rail */}
            <aside className="w-64 shrink-0">
                <Card padding="sm">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--st-text)]">
                            <Folder className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                            Folders
                        </span>
                        <Badge tone="neutral">{initialFolders.length}</Badge>
                    </div>
                    <ScrollArea className="h-[calc(100vh-12rem)] pr-2">
                        <nav className="flex flex-col gap-0.5" aria-label="Folders">
                            <FolderLink
                                href="/dashboard/sabvault"
                                label="All secrets"
                                active={!selectedFolderId}
                            />
                            {initialFolders.map((f) => (
                                <FolderLink
                                    key={f._id}
                                    href={`/dashboard/sabvault?folder=${encodeURIComponent(f._id ?? '')}`}
                                    label={f.name}
                                    active={selectedFolderId === f._id}
                                />
                            ))}
                        </nav>
                    </ScrollArea>
                </Card>
            </aside>

            {/* Secret list */}
            <main className="flex flex-1 flex-col gap-3">
                <div className="flex items-center gap-2">
                    <form onSubmit={applySearch} className="flex-1">
                        <SearchInput
                            value={query}
                            onValueChange={setQuery}
                            placeholder="Search secrets"
                            aria-label="Search secrets"
                        />
                    </form>
                    <Link href="/dashboard/sabvault/audit">
                        <Button variant="outline" iconLeft={Eye}>
                            Audit log
                        </Button>
                    </Link>
                    <Link href="/dashboard/sabvault/health">
                        <Button variant="outline" iconLeft={Activity}>
                            Health
                        </Button>
                    </Link>
                    <CreateSecretDialog keyRecord={keyRecord} />
                </div>

                {!keyRecord ? (
                    <Callout tone="info" icon={LockKeyhole} title="Set up your vault">
                        <div className="flex items-center justify-between gap-3">
                            <span>Choose a master password. It never leaves this browser.</span>
                            <Link href="/dashboard/sabvault/unlock">
                                <Button size="sm">Set up</Button>
                            </Link>
                        </div>
                    </Callout>
                ) : !isUnlocked ? (
                    <Callout tone="warning" icon={Lock} title="Vault is locked">
                        <div className="flex items-center justify-between gap-3">
                            <span>Names and URLs are visible. Reveal or copy requires unlock.</span>
                            <Link href="/dashboard/sabvault/unlock">
                                <Button size="sm" iconLeft={KeyRound}>
                                    Unlock
                                </Button>
                            </Link>
                        </div>
                    </Callout>
                ) : null}

                <Card padding="none">
                    {initialSecrets.length === 0 ? (
                        <div className="p-6">
                            <EmptyState
                                icon={KeyRound}
                                title="No secrets yet"
                                description="Add your first credential to keep it encrypted and out of plaintext."
                                action={<CreateSecretDialog keyRecord={keyRecord} />}
                            />
                        </div>
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {initialSecrets.map((s) => {
                                const Icon = KIND_ICON[s.kind] ?? KeySquare;
                                return (
                                    <li
                                        key={s._id}
                                        className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--st-bg-secondary)]"
                                    >
                                        <Link
                                            href={`/dashboard/sabvault/${s._id}`}
                                            className="flex flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                                        >
                                            <span
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] group-hover:text-[var(--st-accent)]"
                                                aria-hidden="true"
                                            >
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-[var(--st-text)]">{s.name}</div>
                                                <div className="text-xs text-[var(--st-text-secondary)]">
                                                    {s.url || s.kind}
                                                </div>
                                            </div>
                                        </Link>
                                        <div className="flex items-center gap-2">
                                            {s.breached ? <Badge tone="danger" dot>Breached</Badge> : null}
                                            {s.reused ? <Badge tone="warning" dot>Reused</Badge> : null}
                                            <Separator orientation="vertical" className="h-5" />
                                            <Link href={`/dashboard/sabvault/share/${s._id}`}>
                                                <Button variant="ghost" size="sm" iconLeft={ShieldCheck}>
                                                    Share
                                                </Button>
                                            </Link>
                                            <ChevronRight
                                                className="h-4 w-4 text-[var(--st-text-tertiary)] transition-transform group-hover:translate-x-0.5"
                                                aria-hidden="true"
                                            />
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
            </main>
        </div>
    );
}

function FolderLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    const Icon = active ? FolderOpen : Folder;
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-[var(--st-radius)] px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] ${
                active
                    ? 'bg-[var(--st-bg-secondary)] font-medium text-[var(--st-text)]'
                    : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]'
            }`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
        </Link>
    );
}
