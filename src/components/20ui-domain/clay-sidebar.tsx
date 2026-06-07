'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button, IconButton, cn } from '@/components/sabcrm/20ui';

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
 * ClaySidebar - left column for the dashboard. Active-state and nav
 * item rendering logic is preserved verbatim; the styling tokens have
 * been migrated to the 20ui design system (`--st-*` tokens, 20ui
 * `Button`/`IconButton` primitives). The 20ui `Sidebar` primitive is
 * intentionally not used here because its collapsible/provider chrome
 * (and required `SidebarProvider` context) would diverge from the simple
 * props this component exposes.
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
        'bg-[var(--st-bg-secondary)]',
        className,
      )}
      {...props}
    >
      {brand ? <div className="px-2 pb-5 shrink-0">{brand}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <div className="px-2">
          <h2 className="text-[17px] font-semibold tracking-tight text-[var(--st-text)] leading-none">
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
                  <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-[var(--st-text-secondary)]">
                    {group.title}
                  </span>
                  {group.addable ? (
                    <IconButton
                      label={`Add ${group.title}`}
                      icon={Plus}
                      size="sm"
                      onClick={group.onAdd}
                      className="!h-5 !w-5 text-[var(--st-text-secondary)]"
                    />
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

// Shared layout for a nav row. Tailwind overrides (with `!`) reset the 20ui
// `u-btn` base chrome (fixed height, centered content, border) so a nav item
// reads as a full-width, left-aligned, compact row with a custom active state.
const navItemClass = cn(
  '!w-full !justify-start !gap-2.5 !rounded-[var(--st-radius)] !px-2.5 !py-1.5 !h-auto',
  '!text-[13px] !font-medium !leading-tight !border-0 !bg-transparent',
  '!text-[var(--st-text-secondary)] hover:!bg-[var(--st-bg-muted)] hover:!text-[var(--st-text)]',
  'data-[active=true]:!bg-[var(--st-text)] data-[active=true]:!text-white data-[active=true]:hover:!bg-[var(--st-text)]',
);

function NavItem({ item }: { item: ClayNavItem }) {
  const content = (
    <>
      {item.icon ? (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {item.icon}
        </span>
      ) : null}
      <span className="truncate">{item.label}</span>
    </>
  );

  // Use next/link for client-side navigation, no full page reload. The 20ui
  // Button cannot render as a link, so href items wrap the row content in a
  // Link styled to match the nav-item appearance.
  if (item.href) {
    return (
      <Link
        href={item.href}
        data-active={item.active ? 'true' : 'false'}
        aria-current={item.active ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-[var(--st-radius)] px-2.5 py-1.5 text-[13px] font-medium leading-tight transition-colors',
          'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]',
          'data-[active=true]:bg-[var(--st-text)] data-[active=true]:text-white data-[active=true]:hover:bg-[var(--st-text)]',
        )}
      >
        {content}
      </Link>
    );
  }

  // Purely interactive (no-href) nav rows use the 20ui Button (ghost) so we
  // never render a raw <button>.
  return (
    <Button
      variant="ghost"
      block
      onClick={item.onClick}
      data-active={item.active ? 'true' : 'false'}
      aria-current={item.active ? 'page' : undefined}
      className={navItemClass}
    >
      {content}
    </Button>
  );
}
