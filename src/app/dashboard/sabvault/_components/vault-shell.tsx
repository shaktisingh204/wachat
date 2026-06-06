'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Card, Input, Badge, EmptyState, ScrollArea, Separator } from '@/components/sabcrm/20ui';
import type { SabvaultFolderDoc } from '@/lib/rust-client/sabvault-folders';
import type { SabvaultSecretDoc } from '@/lib/rust-client/sabvault-secrets';

import { useVaultKey } from './vault-key-context';
import type { SabvaultUserKeyRecord } from '@/app/actions/sabvault.actions';
import { CreateSecretDialog } from './create-secret-dialog';

/**
 * Main vault shell: three columns - folder tree, secret list, action bar.
 * Forwards a "needs unlock" affordance when the in-memory key is missing.
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
        <div className="ui20 flex h-full min-h-[calc(100vh-4rem)] gap-4 p-4">
            {/* Folder tree */}
            <aside className="w-64 shrink-0">
                <Card padding="sm">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-[var(--st-text)]">Folders</span>
                        <Badge>{initialFolders.length}</Badge>
                    </div>
                    <ScrollArea className="h-[calc(100vh-12rem)] pr-2">
                        <div className="flex flex-col gap-1">
                            <Link
                                href="/dashboard/sabvault"
                                className={`rounded-[var(--st-radius)] px-2 py-1.5 text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] ${
                                    !selectedFolderId ? 'bg-[var(--st-bg-secondary)] font-medium' : ''
                                }`}
                            >
                                All secrets
                            </Link>
                            {initialFolders.map((f) => (
                                <Link
                                    key={f._id}
                                    href={`/dashboard/sabvault?folder=${encodeURIComponent(f._id ?? '')}`}
                                    className={`rounded-[var(--st-radius)] px-2 py-1.5 text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] ${
                                        selectedFolderId === f._id ? 'bg-[var(--st-bg-secondary)] font-medium' : ''
                                    }`}
                                >
                                    {f.name}
                                </Link>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>
            </aside>

            {/* Secret list */}
            <main className="flex-1">
                <div className="mb-3 flex items-center gap-2">
                    <form onSubmit={applySearch} className="flex flex-1 gap-2">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search secrets"
                            aria-label="Search secrets"
                        />
                        <Button type="submit" variant="outline">
                            Search
                        </Button>
                    </form>
                    <Link href="/dashboard/sabvault/audit">
                        <Button variant="outline">Audit log</Button>
                    </Link>
                    <Link href="/dashboard/sabvault/health">
                        <Button variant="outline">Health</Button>
                    </Link>
                    <CreateSecretDialog keyRecord={keyRecord} />
                </div>

                {!isUnlocked && keyRecord ? (
                    <Card className="mb-3" padding="md">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-[var(--st-text)]">Vault is locked</div>
                                <div className="text-xs text-[var(--st-text-secondary)]">
                                    Names and URLs are visible. Reveal or copy requires unlock.
                                </div>
                            </div>
                            <Link href="/dashboard/sabvault/unlock">
                                <Button>Unlock</Button>
                            </Link>
                        </div>
                    </Card>
                ) : null}

                {!keyRecord ? (
                    <Card className="mb-3" padding="md">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-semibold text-[var(--st-text)]">Set up your vault</div>
                                <div className="text-xs text-[var(--st-text-secondary)]">
                                    Choose a master password, it never leaves this browser.
                                </div>
                            </div>
                            <Link href="/dashboard/sabvault/unlock">
                                <Button>Set up</Button>
                            </Link>
                        </div>
                    </Card>
                ) : null}

                <Card padding="none">
                    {initialSecrets.length === 0 ? (
                        <div className="p-6">
                            <EmptyState title="No secrets yet" description="Add your first credential to get started." />
                        </div>
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {initialSecrets.map((s) => (
                                <li key={s._id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <Link
                                        href={`/dashboard/sabvault/${s._id}`}
                                        className="flex flex-1 items-center gap-3"
                                    >
                                        <KindGlyph kind={s.kind} />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-[var(--st-text)]">{s.name}</div>
                                            <div className="text-xs text-[var(--st-text-secondary)]">
                                                {s.url || s.kind}
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        {s.breached ? <Badge variant="destructive">Breached</Badge> : null}
                                        {s.reused ? <Badge>Reused</Badge> : null}
                                        <Separator orientation="vertical" className="h-5" />
                                        <Link href={`/dashboard/sabvault/share/${s._id}`}>
                                            <Button variant="ghost" size="sm">
                                                Share
                                            </Button>
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </main>
        </div>
    );
}

function KindGlyph({ kind }: { kind: string }) {
    const ch =
        kind === 'login'
            ? '🔐'
            : kind === 'note'
              ? '📝'
              : kind === 'card'
                ? '💳'
                : kind === 'identity'
                  ? '🪪'
                  : kind === 'key'
                    ? '🔑'
                    : kind === 'wifi'
                      ? '📶'
                      : kind === 'server'
                        ? '🖥️'
                        : '🗝️';
    return (
        <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-base"
        >
            {ch}
        </span>
    );
}
