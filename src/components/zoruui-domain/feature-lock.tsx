'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { Lock } from 'lucide-react';

import Link from 'next/link';

export function FeatureLock({ isAllowed, children }: { isAllowed: boolean; children: React.ReactNode }) {
    if (isAllowed) {
        return <>{children}</>;
    }

    return (
        <div className="relative blur-sm pointer-events-none opacity-50">
            {children}
        </div>
    );
}

export function FeatureLockOverlay({ isAllowed, featureName }: { isAllowed: boolean; featureName: string }) {
    if (isAllowed) return null;

    return (
        <div className="absolute inset-0 bg-zoru-surface/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4 p-4 text-center rounded-lg">
            <Lock className="h-12 w-12 text-zoru-ink-muted"/>
            <h3 className="text-xl font-bold">'{featureName}' is a Premium Feature</h3>
            <p className="text-zoru-ink-muted">This feature is not included in your current plan.</p>
            <Button asChild>
                <Link href="/dashboard/user/billing#upgrade">Upgrade Plan</Link>
            </Button>
        </div>
    )
}
