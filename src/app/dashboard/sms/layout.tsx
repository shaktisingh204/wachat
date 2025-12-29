
'use client';

import React from 'react';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';
import { MessageSquare } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const smsNavItems = [
    { href: '/dashboard/sms', label: 'Dashboard' },
    { href: '/dashboard/sms/campaigns', label: 'Campaigns' },
    { href: '/dashboard/sms/message-history', label: 'History' },
    { href: '/dashboard/sms/contacts', label: 'Contacts' },
    { href: '/dashboard/sms/dlt', label: 'DLT' },
    { href: '/dashboard/sms/analytics', label: 'Analytics' },
    { href: '/dashboard/sms/settings', label: 'Settings' },
];

export default function SmsLayout({ children }: { children: React.ReactNode }) {
    const { sessionUser } = useProject();
    const isAllowed = sessionUser?.plan?.features?.sms ?? false;
    const pathname = usePathname();

    return (
        <div className="relative h-full">
             <FeatureLockOverlay isAllowed={isAllowed} featureName="SMS Suite" />
             <FeatureLock isAllowed={isAllowed}>
                <div className="flex flex-col gap-6 h-full">
                     <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><MessageSquare /> SMS Suite</h1>
                        <p className="text-muted-foreground">Manage your SMS campaigns, contacts, and DLT settings.</p>
                    </div>
                    <Tabs value={pathname}>
                        <TabsList>
                            {smsNavItems.map(item => (
                                <TabsTrigger key={item.href} value={item.href} asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    {children}
                </div>
            </FeatureLock>
        </div>
    );
}
