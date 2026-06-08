'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Inbox,
    Users,
    MessageSquareText,
    Timer,
    Clock,
    Tags,
    Settings2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
    { label: 'Inboxes', href: '/dashboard/sabchat/admin/inboxes', icon: Inbox },
    { label: 'Teams', href: '/dashboard/sabchat/admin/teams', icon: Users },
    { label: 'Macros', href: '/dashboard/sabchat/admin/macros', icon: MessageSquareText },
    { label: 'SLA policies', href: '/dashboard/sabchat/admin/sla', icon: Timer },
    { label: 'Business hours', href: '/dashboard/sabchat/admin/business-hours', icon: Clock },
    { label: 'Dispositions', href: '/dashboard/sabchat/admin/dispositions', icon: Tags },
];

export default function SabchatAdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="20ui flex h-[calc(100vh-4rem)] gap-4 p-4">
            <Card className="flex h-full w-64 shrink-0 flex-col" padding="none">
                <CardHeader className="flex items-center gap-2">
                    <span
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
                        aria-hidden="true"
                    >
                        <Settings2 size={16} />
                    </span>
                    <CardTitle>Admin</CardTitle>
                    <Badge tone="neutral" kind="soft" className="ml-auto text-[10px]">
                        {NAV_ITEMS.length}
                    </Badge>
                </CardHeader>
                <CardBody className="flex-1 overflow-y-auto p-2">
                    <nav aria-label="SabChat admin sections" className="flex flex-col gap-1">
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            const active =
                                pathname === item.href || pathname.startsWith(`${item.href}/`);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={[
                                        'group flex items-center gap-2.5 rounded-[var(--st-radius)] px-3 py-2 text-sm font-medium transition-colors',
                                        active
                                            ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
                                            : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-hover)] hover:text-[var(--st-text)]',
                                    ].join(' ')}
                                >
                                    <Icon
                                        size={16}
                                        className={
                                            active
                                                ? 'text-[var(--st-accent)]'
                                                : 'text-[var(--st-text-tertiary)] group-hover:text-[var(--st-text)]'
                                        }
                                        aria-hidden="true"
                                    />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </CardBody>
            </Card>
            <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
        </div>
    );
}
