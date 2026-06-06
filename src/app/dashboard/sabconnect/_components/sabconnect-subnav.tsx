'use client';

import { useRouter, usePathname } from 'next/navigation';

import { TabsBar, type TabItem } from '@/components/sabcrm/20ui';

const TABS: TabItem[] = [
    { value: '/dashboard/sabconnect/feed', label: 'Feed' },
    { value: '/dashboard/sabconnect/groups', label: 'Groups' },
    { value: '/dashboard/sabconnect/manuals', label: 'Manuals' },
    { value: '/dashboard/sabconnect/people', label: 'People' },
    { value: '/dashboard/sabconnect/apps', label: 'Apps' },
];

export function SabConnectSubnav() {
    const router = useRouter();
    const pathname = usePathname() ?? '';

    const active =
        TABS.find((tab) => pathname.startsWith(tab.value))?.value ?? TABS[0].value;

    return (
        <TabsBar
            aria-label="SabConnect sections"
            idBase="sabconnect-subnav"
            items={TABS}
            value={active}
            onChange={(href) => router.push(href)}
        />
    );
}
