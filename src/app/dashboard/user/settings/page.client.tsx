'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter, Button, Skeleton } from '@/components/sabcrm/20ui';
import { useEffect, useState } from 'react';
import { getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { User as UserIcon, Brush, CreditCard, ArrowRight, ShieldCheck, Mail, Building } from 'lucide-react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

function SettingsOverviewSkeleton() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-1/4 mb-2" />
                <Skeleton className="h-4 w-1/3" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-1/2" />
                            <Skeleton className="h-4 w-full mt-2" />
                        </CardHeader>
                        <CardBody>
                            <Skeleton className="h-16 w-full" />
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export default function UserSettingsOverviewPage() {
    const [user, setUser] = useState<(Omit<User, 'password'>) | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = "Settings | SabNode";
        getSession().then(session => {
            if (session?.user) {
                setUser(session.user);
            }
            setLoading(false);
        });
    }, []);

    if (loading) {
        return <SettingsOverviewSkeleton />;
    }

    if (!user) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><AlertCircle /> Error</CardTitle>
                </CardHeader>
                <CardBody>
                    <p>Could not load settings overview. Please log in again.</p>
                </CardBody>
            </Card>
        );
    }

    const settingsCards = [
        {
            title: 'Profile Settings',
            description: 'Update your personal details, business information, and change your password.',
            icon: UserIcon,
            href: '/dashboard/user/settings/profile',
            details: [
                { icon: Mail, text: user.email },
                { icon: Building, text: user.businessProfile?.name || 'No business added' },
            ]
        },
        {
            title: 'UI Preferences',
            description: 'Customize the appearance of your dashboard and navigation rail.',
            icon: Brush,
            href: '/dashboard/user/settings/ui',
            details: [
                { icon: ShieldCheck, text: `App Rail: ${user.appRailPosition || 'left'}` },
            ]
        },
        {
            title: 'Billing & Plans',
            description: 'Manage your active subscriptions, payment methods, and billing history.',
            icon: CreditCard,
            href: '/dashboard/user/billing',
            details: [
                { icon: ShieldCheck, text: 'View Billing Portal' },
            ]
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings Overview</h1>
                <p className="text-[var(--st-text-secondary)] mt-2">
                    Manage your account settings, preferences, and billing.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {settingsCards.map((card) => (
                    <Card key={card.title} className="flex flex-col h-full hover:border-primary/50 transition-colors">
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-2 bg-[var(--st-text)]/10 rounded-md">
                                    <card.icon className="h-5 w-5 text-[var(--st-text)]" />
                                </div>
                                <CardTitle className="text-xl">{card.title}</CardTitle>
                            </div>
                            <CardDescription>{card.description}</CardDescription>
                        </CardHeader>
                        <CardBody className="flex-1">
                            <div className="space-y-2 mt-2">
                                {card.details.map((detail, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                                        <detail.icon className="h-4 w-4" />
                                        <span className="truncate">{detail.text}</span>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                        <CardFooter>
                            <Button asChild variant="outline" className="w-full justify-between group">
                                <Link href={card.href}>
                                    Manage {card.title.split(' ')[0]}
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
            
            <Card className="bg-[var(--st-bg-muted)]/30 border-dashed">
                <CardHeader>
                    <CardTitle>Need Help?</CardTitle>
                    <CardDescription>If you have any questions about your account settings, our support team is here to help.</CardDescription>
                </CardHeader>
                <CardBody>
                    <Button asChild variant="default">
                        <Link href="/dashboard/sabchat/faq">View FAQ</Link>
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}
