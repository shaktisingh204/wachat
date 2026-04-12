'use client';

import Link from 'next/link';
import { Settings, Facebook, Briefcase, Wallet, Bell, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const ITEMS = [
    { href: '/dashboard/ad-manager/ad-accounts', icon: Briefcase, title: 'Ad accounts', desc: 'Manage connected Meta ad accounts.' },
    { href: '/dashboard/ad-manager/billing', icon: Wallet, title: 'Billing', desc: 'Payment methods and spend overview.' },
    { href: '/dashboard/ad-manager/pixels', icon: Shield, title: 'Pixels & datasets', desc: 'Tracking and conversion APIs.' },
    { href: '/dashboard/ad-manager/automated-rules', icon: Bell, title: 'Automated rules', desc: 'Alerts and auto-actions.' },
];

export default function AdManagerSettingsPage() {
    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Settings className="h-6 w-6" /> Settings
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Configure your Ads Manager experience.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
                {ITEMS.map((i) => {
                    const Icon = i.icon;
                    return (
                        <Link key={i.href} href={i.href}>
                            <Card className="hover:border-[#1877F2]/50 transition-colors cursor-pointer h-full">
                                <CardContent className="p-4 flex gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-medium">{i.title}</div>
                                        <div className="text-xs text-muted-foreground">{i.desc}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
