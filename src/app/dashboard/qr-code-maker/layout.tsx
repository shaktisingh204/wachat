'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';
import { cn } from '@/components/zoruui';
import { QrCode, LayoutGrid, Settings, Palette } from 'lucide-react';

const QR_NAV = [
    { href: '/dashboard/qr-code-maker',           label: 'QR Codes',  icon: QrCode },
    { href: '/dashboard/qr-code-maker/campaigns',  label: 'Campaigns', icon: LayoutGrid },
    { href: '/dashboard/qr-code-maker/settings',   label: 'Settings',  icon: Settings },
];

const QR_SUBNAV: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
    '/dashboard/qr-code-maker/settings': [
        { href: '/dashboard/qr-code-maker/settings/brand-kit', label: 'Brand Kit', icon: Palette },
    ],
};

export default function QrCodeMakerLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.qrCodeMaker ?? false;
    const pathname = usePathname();

    const activeSubnav = Object.entries(QR_SUBNAV).find(([key]) => pathname.startsWith(key))?.[1];

    return (
        <div className="relative h-full flex flex-col">
            <FeatureLockOverlay isAllowed={isAllowed} featureName="QR Code Maker" />
            <FeatureLock isAllowed={isAllowed}>
                <div className="flex items-center gap-1 border-b border-zoru-border px-4 pt-1 pb-0 flex-shrink-0">
                    {QR_NAV.map(({ href, label, icon: Icon }) => {
                        const isActive = pathname === href || (href !== '/dashboard/qr-code-maker' && pathname.startsWith(href));
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-2 text-[12.5px] border-b-2 transition-colors -mb-px',
                                    isActive
                                        ? 'border-amber-400 text-zoru-ink font-medium'
                                        : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink hover:border-zoru-border'
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </Link>
                        );
                    })}
                </div>
                {activeSubnav && (
                    <div className="flex items-center gap-1 border-b border-zoru-border px-6 pb-0 pt-0.5 flex-shrink-0 bg-zinc-950/50">
                        {activeSubnav.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname === href || pathname.startsWith(href);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 text-[12px] border-b-2 transition-colors -mb-px',
                                        isActive
                                            ? 'border-amber-400/70 text-zoru-ink'
                                            : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink'
                                    )}
                                >
                                    <Icon className="h-3 w-3" />
                                    {label}
                                </Link>
                            );
                        })}
                    </div>
                )}
                <div className="flex-1 min-h-0">
                    {children}
                </div>
            </FeatureLock>
        </div>
    );
}
