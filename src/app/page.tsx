import { Suspense } from 'react';
import { getSession } from '@/app/actions';
import { LandingV2 } from '@/components/landing-v2';

export const dynamic = 'force-dynamic';

async function HomePageContent() {
    const session = await getSession();
    return <LandingV2 initialSession={session} />;
}

export default function HomePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zoru-ink" />}>
            <HomePageContent />
        </Suspense>
    );
}
