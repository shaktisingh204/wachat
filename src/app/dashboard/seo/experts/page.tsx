'use client';

import { ZoruCard, ZoruCardDescription, ZoruCardTitle } from '@/components/zoruui';
import { Users } from 'lucide-react';

export default function ExpertsDirectoryPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl text-zoru-ink">Hire a Vetted Expert</h1>
                <p className="text-zoru-ink-muted mt-2">
                    Need help fixing those Critical Issues? Match with a pro who knows this platform.
                </p>
            </div>

            <ZoruCard className="flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
                    <Users className="h-6 w-6 text-zoru-ink-muted" />
                </div>
                <ZoruCardTitle className="text-lg">No experts configured</ZoruCardTitle>
                <ZoruCardDescription className="max-w-md">
                    The expert directory is ready for real marketplace profiles. No sample experts are shown.
                </ZoruCardDescription>
            </ZoruCard>
        </div>
    );
}
