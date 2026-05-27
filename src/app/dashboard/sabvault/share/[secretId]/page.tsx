import * as React from 'react';
import { notFound } from 'next/navigation';

import {
    getSabvaultSecret,
    listSabvaultSharesForSecret,
} from '@/app/actions/sabvault.actions';

import { ShareDialogClient } from './_share-client';

export const dynamic = 'force-dynamic';

export default async function SabvaultShareSecretPage(props: {
    params: Promise<{ secretId: string }>;
}) {
    const { secretId } = await props.params;
    const [secret, existing] = await Promise.all([
        getSabvaultSecret(secretId),
        listSabvaultSharesForSecret(secretId),
    ]);
    if (!secret) notFound();
    return <ShareDialogClient secret={secret} initialShares={existing} />;
}
