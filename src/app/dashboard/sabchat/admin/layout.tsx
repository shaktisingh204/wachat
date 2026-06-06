import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';

export default function SabchatAdminLayout({ children }: { children: React.ReactNode }) {
    const navItems = [
        { label: 'Inboxes', href: '/dashboard/sabchat/admin/inboxes' },
        { label: 'Teams', href: '/dashboard/sabchat/admin/teams' },
        { label: 'Macros', href: '/dashboard/sabchat/admin/macros' },
        { label: 'SLA', href: '/dashboard/sabchat/admin/sla' },
        { label: 'Business Hours', href: '/dashboard/sabchat/admin/business-hours' },
        { label: 'Dispositions', href: '/dashboard/sabchat/admin/dispositions' },
    ];

    return (
        <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
            <Card className="flex h-full w-64 shrink-0 flex-col">
                <CardHeader>
                    <CardTitle>SabChat Admin</CardTitle>
                </CardHeader>
                <CardBody className="flex-1 overflow-y-auto p-2">
                    <nav aria-label="SabChat admin sections" className="flex flex-col gap-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="rounded-[var(--st-radius)] px-4 py-2 text-sm font-medium text-[var(--st-text)] transition-colors hover:bg-[var(--st-hover)]"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </CardBody>
            </Card>
            <main className="flex flex-1 flex-col overflow-hidden">
                {children}
            </main>
        </div>
    );
}
