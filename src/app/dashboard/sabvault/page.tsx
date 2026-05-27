import * as React from 'react';

import { getSabvaultUserKey, listSabvaultFolders, listSabvaultSecrets } from '@/app/actions/sabvault.actions';

import { VaultShell } from './_components/vault-shell';

export const dynamic = 'force-dynamic';

/**
 * SabVault root — folder tree on the left, secret list on the right.
 * Server-renders the metadata, the client island handles unlock state
 * and decrypt-on-reveal.
 */
export default async function SabvaultPage(props: {
    searchParams: Promise<{ folder?: string; q?: string; status?: string }>;
}) {
    const sp = await props.searchParams;
    const [keyRecord, folders, secrets] = await Promise.all([
        getSabvaultUserKey(),
        listSabvaultFolders(),
        listSabvaultSecrets({
            folderId: sp.folder,
            q: sp.q,
            status: (sp.status as 'active' | 'archived' | 'all' | undefined) ?? 'active',
            limit: 50,
        }),
    ]);

    return (
        <VaultShell
            initialFolders={folders}
            initialSecrets={secrets.items}
            keyRecord={keyRecord}
            selectedFolderId={sp.folder ?? null}
            search={sp.q ?? ''}
        />
    );
}
