'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Settings, User, Brush } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const settingsNavItems = [
    { href: '/dashboard/settings/profile', label: 'Profile', icon: User },
    { href: '/dashboard/settings/ui', label: 'UI Preferences', icon: Brush },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                <Settings className="h-8 w-8" />
                Settings
            </h1>
            <p className="text-muted-foreground">Manage your account and application settings.</p>
        </div>
        <div className="grid md:grid-cols-12 gap-8 items-start">
            <aside className="md:col-span-3 lg:col-span-2">
                 <Card>
                    <CardContent className="p-2">
                        <nav className="flex flex-col space-y-1">
                            {settingsNavItems.map(item => (
                                <Button
                                    key={item.href}
                                    asChild
                                    variant={pathname === item.href ? 'secondary' : 'ghost'}
                                    className="justify-start"
                                >
                                    <Link href={item.href}>
                                        <item.icon className="mr-2 h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                        </nav>
                    </CardContent>
                </Card>
            </aside>
            <main className="md:col-span-9 lg:col-span-10">
                {children}
            </main>
        </div>
  );
}
