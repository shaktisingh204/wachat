'use client';

import * as React from 'react';
import Link from 'next/link';
import { LuPlus } from 'react-icons/lu';
import { cn } from '@/lib/utils';

export interface ClayNavItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface ClayNavGroup {
  title?: string;
  items: ClayNavItem[];
  addable?: boolean;
  onAdd?: () => void;
}

export interface ClaySidebarProps extends React.HTMLAttributes<HTMLElement> {
  brand?: React.ReactNode;
  groupTitle: string;            // e.g. "Rounds"
  groups: ClayNavGroup[];
  footer?: React.ReactNode;      // user card + promo live here
}

/**
 * ClaySidebar — left column for the dashboard. Active-state and nav
 * item rendering logic is preserved verbatim; only the styling tokens
 * have been migrated to shadcn (`bg-sidebar`, `bg-secondary`, etc.)
 * The shadcn `Sidebar` primitive is intentionally not used here
 * because its built-in collapsible/provider chrome would diverge
 * from the simple props this component exposes.
 */
export function ClaySidebar({
  brand,
  groupTitle,
  groups,
  footer,
  className,
  ...props
}: ClaySidebarProps) {
  const [primary, ...rest] = groups;

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-full max-h-full shrink-0 flex-col pb-5',
        'w-[244px] px-4 pt-6',
        // Use the sidebar token if defined; fall back to muted background.
        'bg-[hsl(var(--sidebar-background,36_18%_96%))]',
        className,
      )}
      {...props}
    >
      {brand ? <div className="px-2 pb-5 shrink-0">{brand}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <div className="px-2">
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground leading-none">
            {groupTitle}
          </h2>
        </div>
        {primary ? (
          <nav
            className="mt-3 flex flex-col gap-[3px] px-0"
            aria-label={groupTitle}
          >
            {primary.items.map((item) => (
              <NavItem key={item.key} item={item} />
            ))}
          </nav>
        ) : null}

        <div className="mt-7 flex flex-col gap-5 pb-2">
          {rest.map((group, i) => (
            <div key={i}>
              {group.title ? (
                <div className="flex items-center justify-between px-2.5 pb-2">
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                    {group.title}
                  </span>
                  {group.addable ? (
                    <button
                      type="button"
                      onClick={group.onAdd}
                      aria-label={`Add ${group.title}`}
                      className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
                    >
                      <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-[3px]">
                {group.items.map((item) => (
                  <NavItem key={item.key} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {footer ? (
        <div className="shrink-0 flex flex-col gap-3 pt-4">{footer}</div>
      ) : null}
    </aside>
  );
}

const navItemClass = cn(
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors',
  'text-muted-foreground hover:bg-secondary hover:text-foreground',
  'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary',
);

function NavItem({ item }: { item: ClayNavItem }) {
  const content = (
    <>
      {item.icon ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {item.icon}
        </span>
      ) : null}
      <span className="truncate">{item.label}</span>
    </>
  );

  // Use next/link for client-side navigation — no full page reload.
  // Falls back to <button> for purely interactive (no-href) nav items.
  if (item.href) {
    return (
      <Link
        href={item.href}
        data-active={item.active ? 'true' : 'false'}
        className={navItemClass}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={item.onClick}
      data-active={item.active ? 'true' : 'false'}
      className={navItemClass}
    >
      {content}
    </button>
  );
}
