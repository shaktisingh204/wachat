'use client';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    CardFooter,
    Button,
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
    ArrowRight,
    Mail,
    Building,
    PanelLeft,
    Receipt,
    AlertCircle,
    LifeBuoy,
} from 'lucide-react';
import Link from 'next/link';

function SettingsOverviewSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="mt-2 h-4 w-full" />
                        </CardHeader>
                        <CardBody>
                            <Skeleton className="h-10 w-full" />
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
}

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

    const settingsCards = [
        {
            key: 'profile',
            title: 'Profile',
            description: 'Personal details, business information, and password.',
            icon: UserIcon,
            href: '/dashboard/user/settings/profile',
            details: [
                { icon: Mail, text: user.email },
                { icon: Building, text: user.businessProfile?.name || 'No business added' },
            ],
        },
        {
            key: 'ui',
            title: 'UI Preferences',
            description: 'Navigation layout and dashboard language.',
            icon: Brush,
            href: '/dashboard/user/settings/ui',
            details: [
                { icon: PanelLeft, text: `App rail: ${user.appRailPosition || 'left'}` },
            ],
        },
        {
            key: 'billing',
            title: 'Billing & Plans',
            description: 'Subscriptions, payment methods, and invoices.',
            icon: CreditCard,
            href: '/dashboard/user/billing',
            details: [
                { icon: Receipt, text: 'Open billing portal' },
            ],
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Account</PageEyebrow>
                    <PageTitle>Settings</PageTitle>
                    <PageDescription>Manage your account, preferences, and billing.</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button asChild variant="ghost">
                        <Link href="/dashboard/sabchat/faq">
                            <LifeBuoy size={16} aria-hidden="true" />
                            Help &amp; FAQ
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            <div className="grid gap-4 md:grid-cols-3">
                {settingsCards.map((card) => {
                    const Icon = card.icon;
                    return (
                    <Card key={card.key} className="flex h-full flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Icon size={18} aria-hidden="true" />
                                {card.title}
                            </CardTitle>
                            <CardDescription>{card.description}</CardDescription>
                        </CardHeader>
                        <CardBody className="flex-1">
                            <ul className="space-y-2">
                                {card.details.map((detail, idx) => {
                                    const DetailIcon = detail.icon;
                                    return (
                                    <li
                                        key={idx}
                                        className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]"
                                    >
                                        <DetailIcon size={14} aria-hidden="true" />
                                        <span className="truncate">{detail.text}</span>
                                    </li>
                                    );
                                })}
                            </ul>
                        </CardBody>
                        <CardFooter>
                            <Button asChild variant="outline" className="w-full justify-between">
                                <Link href={card.href}>
                                    Manage {card.title.split(' ')[0]}
                                    <ArrowRight size={16} aria-hidden="true" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                    );
                })}
            </div>
        </div>
    );
}
