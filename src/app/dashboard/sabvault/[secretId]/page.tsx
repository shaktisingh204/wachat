import * as React from 'react';
import { notFound } from 'next/navigation';

import { getSabvaultSecret } from '@/app/actions/sabvault.actions';

import { SecretDetailClient } from './_secret-detail-client';

export const dynamic = 'force-dynamic';

export default async function SabvaultSecretPage(props: {
    params: Promise<{ secretId: string }>;
}) {
    const { secretId } = await props.params;
    const secret = await getSabvaultSecret(secretId);
    if (!secret) notFound();
    return <SecretDetailClient secret={secret} />;
}
