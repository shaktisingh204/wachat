'use client';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Card,
    CardBody,
    Button,
    Badge,
    Separator,
    EmptyState,
    Skeleton,
} from '@/components/sabcrm/20ui';
import { useEffect, useState } from 'react';
import { getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import {
    User as UserIcon,
    Brush,
    CreditCard,
    ChevronRight,
    Mail,
    Building2,
    PanelLeft,
    Languages,
    AlertCircle,
    LifeBuoy,
    type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

function SettingsOverviewSkeleton() {
    return (
        <div className="flex max-w-[880px] flex-col gap-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-44" />
                <Skeleton className="h-4 w-72" />
            </div>
            <Card padding="none">
                {[0, 1, 2].map((i) => (
                    <div key={i}>
                        {i > 0 ? <Separator /> : null}
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <Skeleton className="h-9 w-9 rounded-[var(--st-radius)]" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-56" />
                                </div>
                                <Skeleton className="h-4 w-4" />
                            </div>
                        </CardBody>
                    </div>
                ))}
            </Card>
        </div>
    );
}

type NavItem = {
    key: string;
    title: string;
    description: string;
    icon: LucideIcon;
    accent: string;
    href: string;
    meta?: { icon: LucideIcon; text: string }[];
};

export default function UserSettingsOverviewPage() {
    const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = 'Settings | SabNode';
        getSession().then((session) => {
            if (session?.user) setUser(session.user);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return <SettingsOverviewSkeleton />;
    }

    if (!user) {
        return (
            <EmptyState
                icon={AlertCircle}
                title="Could not load settings"
                description="Your session may have expired. Please sign in again to manage your account."
                action={
                    <Button asChild>
                        <Link href="/login">Sign in</Link>
                    </Button>
                }
            />
        );
    }

    const items: NavItem[] = [
        {
            key: 'profile',
            title: 'Profile',
            description: 'Personal details, business information, and password.',
            icon: UserIcon,
            accent: 'var(--st-accent)',
            href: '/dashboard/user/settings/profile',
            meta: [
                { icon: Mail, text: user.email },
                {
                    icon: Building2,
                    text: user.businessProfile?.name || 'No business added',
                },
            ],
        },
        {
            key: 'ui',
            title: 'UI preferences',
            description: 'Navigation layout and dashboard language.',
            icon: Brush,
            accent: 'var(--st-success)',
            href: '/dashboard/user/settings/ui',
            meta: [
                { icon: PanelLeft, text: `App rail: ${user.appRailPosition || 'left'}` },
                { icon: Languages, text: `Language: ${(user.language || 'en').toUpperCase()}` },
            ],
        },
        {
            key: 'billing',
            title: 'Billing & plans',
            description: 'Subscriptions, payment methods, and invoices.',
            icon: CreditCard,
            accent: 'var(--st-warn)',
            href: '/dashboard/user/billing',
        },
    ];

    return (
        <div className="flex max-w-[880px] flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Account</PageEyebrow>
                    <PageTitle>Settings</PageTitle>
                    <PageDescription>Manage your account, preferences, and billing.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button asChild variant="ghost">
                        <Link href="/sabchat/knowledge">
                            <LifeBuoy size={16} aria-hidden="true" />
                            Help &amp; FAQ
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            <nav aria-label="Settings sections">
                <Card padding="none">
                    {items.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.key}>
                                {idx > 0 ? <Separator /> : null}
                                <Link
                                    href={item.href}
                                    className="group flex items-start gap-3 p-4 no-underline transition-colors hover:bg-[var(--st-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--st-accent)]"
                                >
                                    <span
                                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--st-radius)]"
                                        style={{
                                            background: `color-mix(in srgb, ${item.accent} 12%, transparent)`,
                                            color: item.accent,
                                        }}
                                        aria-hidden="true"
                                    >
                                        <Icon size={18} />
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="text-sm font-semibold text-[var(--st-text)]">
                                            {item.title}
                                        </span>
                                        <span className="text-[0.8125rem] text-[var(--st-text-secondary)]">
                                            {item.description}
                                        </span>
                                        {item.meta && item.meta.length > 0 ? (
                                            <span className="mt-2 flex flex-wrap gap-1">
                                                {item.meta.map((m, i) => {
                                                    const MetaIcon = m.icon;
                                                    return (
                                                        <Badge
                                                            key={i}
                                                            variant="secondary"
                                                            className="inline-flex max-w-full items-center gap-1 font-medium"
                                                        >
                                                            <MetaIcon size={11} aria-hidden="true" />
                                                            <span className="truncate">{m.text}</span>
                                                        </Badge>
                                                    );
                                                })}
                                            </span>
                                        ) : null}
                                    </span>
                                    <ChevronRight
                                        size={16}
                                        className="mt-0.5 flex-shrink-0 text-[var(--st-text-secondary)] transition-colors group-hover:text-[var(--st-text)]"
                                        aria-hidden="true"
                                    />
                                </Link>
                            </div>
                        );
                    })}
                </Card>
            </nav>
        </div>
    );
}
