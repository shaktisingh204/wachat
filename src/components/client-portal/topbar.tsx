'use client';

/**
 * Client Portal top bar — tenant brand on the left, user dropdown on
 * the right. Uses the shared ZoruUserDropdown so the menu looks
 * identical to the dashboard surface.
 */

import * as React from 'react';
import Image from 'next/image';
import { LogOut, UserCircle } from 'lucide-react';

import { ZoruUserDropdown } from '@/components/zoruui/user-dropdown';

export interface ClientPortalTopbarProps {
    brandName: string;
    brandLogo: string | null;
    user: {
        name: string;
        email: string;
        avatar: string | null;
    };
}

export function ClientPortalTopbar({ brandName, brandLogo, user }: ClientPortalTopbarProps) {
    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zoru-line bg-zoru-surface px-6">
            <a href="/portal/client" className="flex items-center gap-3" aria-label={`${brandName} home`}>
                {brandLogo ? (
                    <Image
                        src={brandLogo}
                        alt={`${brandName} logo`}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-md object-contain"
                        unoptimized
                    />
                ) : (
                    <span
                        aria-hidden
                        className="grid h-8 w-8 place-items-center rounded-md bg-zoru-ink text-xs font-semibold text-zoru-on-primary"
                    >
                        {brandName.slice(0, 1).toUpperCase()}
                    </span>
                )}
                <span className="text-sm font-medium text-zoru-ink">{brandName}</span>
            </a>
            <ZoruUserDropdown
                name={user.name || 'Account'}
                email={user.email || undefined}
                avatarUrl={user.avatar ?? undefined}
                items={[
                    {
                        id: 'profile',
                        label: 'Profile',
                        icon: <UserCircle />,
                        href: '/portal/client/profile',
                    },
                ]}
                footerItems={[
                    {
                        id: 'sign-out',
                        label: 'Sign out',
                        icon: <LogOut />,
                        href: '/api/auth/logout',
                        destructive: true,
                    },
                ]}
            />
        </header>
    );
}
