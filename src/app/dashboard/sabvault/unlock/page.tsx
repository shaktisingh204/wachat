import * as React from 'react';

import { getSabvaultUserKey } from '@/app/actions/sabvault.actions';

import { UnlockClient } from './_unlock-client';

export const dynamic = 'force-dynamic';

export default async function SabvaultUnlockPage() {
    const keyRecord = await getSabvaultUserKey();
    return <UnlockClient keyRecord={keyRecord} />;
}
