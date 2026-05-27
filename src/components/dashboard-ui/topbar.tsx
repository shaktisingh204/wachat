'use client';

import Link from 'next/link';
import { m } from 'motion/react';
import { Coins, Sparkles } from 'lucide-react';
import { ZoruNotificationPopover } from '@/components/zoruui/notification-popover';
import { ZoruUserDropdown } from '@/components/zoruui/user-dropdown';
import { UniversalSearch } from '@/components/crm/universal-search';
import { EASE_OUT } from './module-theme';

export interface TopbarProps {
    user?: { name?: string | null; email?: string | null; avatar?: string | null; role?: string | null };
    plan?: { name?: string | null; credits?: number };
}

/**
 * Top bar — translucent strip with the SabNode wordmark, universal
 * search (preserved from existing implementation), plan + credits
 * pill, notifications, and the user dropdown.
 *
 * Background uses the landing's amber/orange/rose accent gradient as a
 * thin top-border highlight so the brand is felt without dominating.
 */
export function Topbar({ user, plan }: TopbarProps) {
    return (
        <m.header
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-[#fafaf7]/85 px-4 backdrop-blur-md md:px-5"
        >
            {/* thin gradient highlight at the very top edge */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 opacity-60"
            />

            <Link
                href="/dashboard"
                aria-label="SabNode home"
                className="group inline-flex items-center gap-2 rounded-lg px-1 py-1 transition-transform duration-150 ease-out hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
                <span
                    aria-hidden
                    className="hidden h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-[0_8px_18px_-8px_rgba(244,63,94,0.45)] md:grid"
                >
                    <span className="text-[12px] font-black leading-none">S</span>
                </span>
                <span className="text-[15px] font-semibold tracking-tight text-zinc-950">SabNode</span>
            </Link>

            {/* Universal search island (preserves existing ⌘K + content). */}
            <div className="ml-2 hidden min-w-0 flex-1 max-w-[480px] md:flex">
                <UniversalSearch />
            </div>

            <div className="ml-auto flex items-center gap-2">
                {plan && (plan.name || typeof plan.credits === 'number') && (
                    <PlanChip name={plan.name} credits={plan.credits} />
                )}
                <ZoruNotificationPopover />
                {user && (
                    <ZoruUserDropdown
                        name={user.name ?? 'Account'}
                        email={user.email ?? undefined}
                        avatarUrl={user.avatar ?? undefined}
                    />
                )}
            </div>
        </m.header>
    );
}

function PlanChip({ name, credits }: { name?: string | null; credits?: number }) {
    return (
        <Link
            href="/dashboard/billing"
            className="group hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-zinc-700 transition-colors duration-150 hover:border-zinc-900 hover:text-zinc-950 md:inline-flex"
            aria-label="Plan and credits"
        >
            {name && (
                <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" strokeWidth={2.25} aria-hidden />
                    <span>{name}</span>
                </span>
            )}
            {typeof credits === 'number' && (
                <>
                    <span aria-hidden className="h-3 w-px bg-zinc-200" />
                    <span className="inline-flex items-center gap-1 tabular-nums">
                        <Coins className="h-3 w-3 text-zinc-500" strokeWidth={2.25} aria-hidden />
                        {credits.toLocaleString('en-IN')}
                    </span>
                </>
            )}
        </Link>
    );
}
