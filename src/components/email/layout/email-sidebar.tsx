'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';

export interface EmailSidebarChildItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  badge?: number | string;
}

export interface EmailSidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
  children?: EmailSidebarChildItem[];
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
          <div key={item.href}>
            <Button
              asChild
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'justify-start w-full gap-2',
                isActive && 'bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]',
              )}
            >
              <Link href={buildHref(item.href)}>
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto text-xs bg-[var(--st-text)]/10 text-[var(--st-text)] px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            </Button>

            {isActive && item.children && item.children.length > 0 && (
              <div className="ml-4 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-[var(--st-border)] pl-2">
                {item.children.map((child) => {
                  const isChildExact = child.href === item.href;
                  const isChildActive = isChildExact
                    ? pathname === child.href
                    : pathname === child.href || pathname.startsWith(`${child.href}/`);
                  const ChildIcon = child.icon;

                  return (
                    <Button
                      key={child.href}
                      asChild
                      variant={isChildActive ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        'justify-start w-full gap-2 h-8 text-sm font-normal',
                        isChildActive && 'bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]',
                        !isChildActive && 'text-[var(--st-text-secondary)]',
                      )}
                    >
                      <Link href={buildHref(child.href)}>
                        {ChildIcon && <ChildIcon className="h-3.5 w-3.5 shrink-0" />}
                        <span className="flex-1 text-left">{child.label}</span>
                        {child.badge !== undefined && (
                          <span className="ml-auto text-xs bg-[var(--st-text)]/10 text-[var(--st-text)] px-2 py-0.5 rounded-full">
                            {child.badge}
                          </span>
                        )}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
