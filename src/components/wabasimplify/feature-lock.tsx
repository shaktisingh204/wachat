
'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        <div className="absolute inset-0 bg-background/80 z-10 flex flex-col items-center justify-center gap-4 p-4 text-center rounded-lg">
            <Lock className="h-12 w-12 text-muted-foreground"/>
            <h3 className="text-xl font-bold">'{featureName}' is a Premium Feature</h3>
            <p className="text-muted-foreground">This feature is not included in your current plan.</p>
            <Button asChild>
                <Link href="/dashboard/billing">Upgrade Plan</Link>
            </Button>
        </div>
    )
}
