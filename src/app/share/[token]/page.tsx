import { notFound } from 'next/navigation';

import { rustClient, RustApiError } from '@/lib/rust-client';
import { ShareLanding } from './share-landing';

export default async function ShareLandingPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
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
