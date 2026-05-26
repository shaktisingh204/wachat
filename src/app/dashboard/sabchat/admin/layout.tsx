import Link from 'next/link';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';

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
        <div className="zoruui flex h-[calc(100vh-4rem)] p-4 gap-4">
            <Card className="w-64 h-full shrink-0 flex flex-col">
                <ZoruCardHeader>
                    <ZoruCardTitle>SabChat Admin</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="flex-1 overflow-y-auto p-2">
                    <nav className="flex flex-col gap-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="px-4 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </ZoruCardContent>
            </Card>
            <main className="flex-1 overflow-hidden flex flex-col">
                {children}
            </main>
        </div>
    );
}
