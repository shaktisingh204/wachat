
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { User, Brush } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const settingsNavItems = [
    { href: '/dashboard/user/settings/profile', label: 'Profile', icon: User },
    { href: '/dashboard/user/settings/ui', label: 'UI Preferences', icon: Brush },
];

export default function UserSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="grid md:grid-cols-[200px_1fr] lg:grid-cols-[250px_1fr] gap-8 items-start">
        <aside>
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
        <main>
          {children}
        </main>
      </div>
    </>
  );
}
