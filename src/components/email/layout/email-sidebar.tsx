'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { ZoruButton } from '@/components/zoruui';
import { cn } from '@/lib/utils';

export interface EmailSidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface EmailSidebarProps {
  items: EmailSidebarItem[];
  accountId?: string;
}

export function EmailSidebar({ items, accountId }: EmailSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (href: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (accountId) params.set('accountId', accountId);
    const qs = params.toString();
    return qs ? `${href}?${qs}` : href;
  };

  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        const isOverview = item.href === '/dashboard/email';
        const isActive = isOverview
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <ZoruButton
            key={item.href}
            asChild
            variant={isActive ? 'secondary' : 'ghost'}
            className={cn(
              'justify-start w-full gap-2',
              isActive && 'bg-muted font-medium text-zoru-ink',
            )}
          >
            <Link href={buildHref(item.href)}>
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          </ZoruButton>
        );
      })}
    </nav>
  );
}
