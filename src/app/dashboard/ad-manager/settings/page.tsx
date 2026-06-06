'use client';

import { Card, CardBody, CardTitle, CardDescription } from '@/components/sabcrm/20ui/compat';
import { Briefcase, Wallet, Bell, Shield } from 'lucide-react';
import Link from 'next/link';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';

const ITEMS = [
    { href: '/dashboard/ad-manager/ad-accounts', icon: Briefcase, title: 'Ad accounts', desc: 'Manage connected Meta ad accounts.' },
    { href: '/dashboard/ad-manager/billing', icon: Wallet, title: 'Billing', desc: 'Payment methods and spend overview.' },
    { href: '/dashboard/ad-manager/pixels', icon: Shield, title: 'Pixels & datasets', desc: 'Tracking and conversion APIs.' },
    { href: '/dashboard/ad-manager/automated-rules', icon: Bell, title: 'Automated rules', desc: 'Alerts and auto-actions.' },
];

export default function AdManagerSettingsPage() {
    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Settings" />
            <AmHeader
                title="Settings"
                description="Configure your Ads Manager experience."
            />

            <div className="grid md:grid-cols-2 gap-3">
                {ITEMS.map((i) => {
                    const Icon = i.icon;
                    return (
                        <Link key={i.href} href={i.href} className="block h-full">
                            <Card interactive variant="soft" className="h-full">
                                <CardBody className="p-4 pt-4 sm:p-4 sm:pt-4 flex gap-3 h-full items-center">
                                    <div className="h-10 w-10 shrink-0 rounded-lg bg-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <CardTitle className="text-sm font-medium">{i.title}</CardTitle>
                                        <CardDescription className="text-xs">{i.desc}</CardDescription>
                                    </div>
                                </CardBody>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
