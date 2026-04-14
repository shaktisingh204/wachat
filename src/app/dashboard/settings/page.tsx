'use client';

import Link from 'next/link';
import {
    LuUser,
    LuShield,
    LuBell,
    LuEye,
    LuSettings,
    LuUsers,
    LuTag,
    LuMessageSquareQuote,
    LuKey,
    LuWebhook,
    LuPuzzle,
    LuCreditCard,
    LuReceipt,
    LuStar,
    LuArrowUpRight,
} from 'react-icons/lu';

import {
    ClayBreadcrumbs,
    ClayCard,
    ClaySectionHeader,
} from '@/components/clay';
import { cn } from '@/lib/utils';

type Tile = {
    href: string;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    tone: string;
};

const SECTIONS: Array<{ title: string; tiles: Tile[] }> = [
    {
        title: 'Account',
        tiles: [
            {
                href: '/dashboard/settings/profile',
                label: 'Profile',
                description: 'Name, email, avatar, and preferred language.',
                icon: LuUser,
                tone: 'from-sky-400 to-sky-600',
            },
            {
                href: '/dashboard/settings/security',
                label: 'Security',
                description: 'Password, 2FA, and active session management.',
                icon: LuShield,
                tone: 'from-red-400 to-red-600',
            },
            {
                href: '/dashboard/settings/notifications',
                label: 'Notifications',
                description: 'Choose which events land in your inbox.',
                icon: LuBell,
                tone: 'from-amber-400 to-amber-600',
            },
            {
                href: '/dashboard/settings/ui',
                label: 'Appearance',
                description: 'Theme, density, and sidebar behavior.',
                icon: LuEye,
                tone: 'from-violet-400 to-violet-600',
            },
        ],
    },
    {
        title: 'Workspace',
        tiles: [
            {
                href: '/dashboard/settings/general',
                label: 'General',
                description: 'Project name, WABA ID, and basic configuration.',
                icon: LuSettings,
                tone: 'from-slate-400 to-slate-600',
            },
            {
                href: '/dashboard/settings/agents',
                label: 'Agents & Roles',
                description: 'Invite agents and tune per-project permissions.',
                icon: LuUsers,
                tone: 'from-rose-400 to-rose-600',
            },
            {
                href: '/dashboard/settings/attributes',
                label: 'User Attributes',
                description: 'Custom contact fields for segmentation.',
                icon: LuTag,
                tone: 'from-emerald-400 to-emerald-600',
            },
            {
                href: '/dashboard/settings/canned',
                label: 'Canned Messages',
                description: 'Shared snippets for faster agent replies.',
                icon: LuMessageSquareQuote,
                tone: 'from-indigo-400 to-indigo-600',
            },
        ],
    },
    {
        title: 'Developer',
        tiles: [
            {
                href: '/dashboard/settings/api-keys',
                label: 'API Keys',
                description: 'Programmatic access tokens, scoped per workspace.',
                icon: LuKey,
                tone: 'from-cyan-400 to-cyan-600',
            },
            {
                href: '/dashboard/settings/webhooks',
                label: 'Webhooks',
                description: 'HTTPS callbacks for events across SabNode modules.',
                icon: LuWebhook,
                tone: 'from-teal-400 to-teal-600',
            },
            {
                href: '/dashboard/settings/integrations',
                label: 'Integrations',
                description: 'Third-party connections (Stripe, Zapier, Slack).',
                icon: LuPuzzle,
                tone: 'from-lime-400 to-lime-600',
            },
        ],
    },
    {
        title: 'Billing',
        tiles: [
            {
                href: '/dashboard/settings/billing',
                label: 'Billing & Plan',
                description: 'Review your plan, features, and upgrade anytime.',
                icon: LuCreditCard,
                tone: 'from-fuchsia-400 to-fuchsia-600',
            },
            {
                href: '/dashboard/settings/credits',
                label: 'Credits',
                description: 'Top-up or monitor broadcast, SMS, and email credits.',
                icon: LuStar,
                tone: 'from-yellow-400 to-yellow-600',
            },
            {
                href: '/dashboard/settings/invoices',
                label: 'Invoices',
                description: 'Download receipts and past billing statements.',
                icon: LuReceipt,
                tone: 'from-pink-400 to-pink-600',
            },
        ],
    },
];

export default function SettingsOverviewPage() {
    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs items={[{ label: 'Settings' }]} />

            <ClaySectionHeader
                size="lg"
                title="Settings"
                subtitle="Your account, workspace, developer tools, and billing — all in one place."
            />

            {SECTIONS.map((section) => (
                <div key={section.title}>
                    <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                        {section.title}
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {section.tiles.map((tile) => (
                            <Link key={tile.href} href={tile.href} className="group">
                                <ClayCard padded className="h-full transition-shadow group-hover:shadow-clay-md">
                                    <div
                                        className={cn(
                                            'mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white',
                                            tile.tone,
                                        )}
                                    >
                                        <tile.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                                    </div>
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-[13.5px] font-semibold text-clay-ink">
                                            {tile.label}
                                        </p>
                                        <LuArrowUpRight className="h-4 w-4 text-clay-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                    </div>
                                    <p className="mt-1 text-[12.5px] leading-relaxed text-clay-ink-muted">
                                        {tile.description}
                                    </p>
                                </ClayCard>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
