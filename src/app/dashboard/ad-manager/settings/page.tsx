'use client';

import { Card, ZoruCardContent } from '@/components/zoruui';
import { Facebook, Briefcase, Wallet, Bell, Shield } from 'lucide-react';

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
                        <Link key={i.href} href={i.href}>
                            <Card className="hover:border-[#1877F2]/50 transition-colors cursor-pointer h-full">
                                <ZoruCardContent className="p-4 flex gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-medium">{i.title}</div>
                                        <div className="text-xs text-muted-foreground">{i.desc}</div>
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
