import * as React from 'react';
import { notFound } from 'next/navigation';

import { rustClient, RustApiError } from '@/lib/rust-client';
import { ShareLanding } from './share-landing';

export const dynamic = 'force-dynamic';

async function ShareLandingContainer({ token }: { token: string }) {
    try {
        const view = await rustClient.sabfiles.publicShareView(token);
        return <ShareLanding token={token} view={view} />;
    } catch (e) {
        if (e instanceof RustApiError && e.status === 404) {
            notFound();
        }
        throw e;
    }
}

export default async function ShareLandingPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    return (
        <React.Suspense fallback={<div>Loading share...</div>}>
            <ShareLandingContainer token={token} />
        </React.Suspense>
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    try {
        const view = await rustClient.sabfiles.publicShareView(token);
        return {
            title: `${view.name} - SabFiles Share`,
            description: view.password_protected
                ? 'This shared file is password protected.'
                : `Shared ${view.type === 'folder' ? 'folder' : 'file'}`,
        };
    } catch {
        return {
            title: 'SabFiles Share',
        };
    }
}
