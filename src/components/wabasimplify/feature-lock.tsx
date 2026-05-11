
'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FeatureLock({ isAllowed: _isAllowed, children }: { isAllowed: boolean; children: React.ReactNode }) {
    return <>{children}</>;
}

export function FeatureLockOverlay({ isAllowed: _isAllowed, featureName: _featureName }: { isAllowed: boolean; featureName: string }) {
    return null;
}
