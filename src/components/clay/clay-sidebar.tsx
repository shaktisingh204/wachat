'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LuPlus } from 'react-icons/lu';

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
 * ClaySidebar — the full left column of the reference.
 * Structure:
 *   [Brand]
 *   [Group title: "Rounds"]
 *     [NavItem Dashboard]
 *     [NavItem Interviews]
 *     [NavItem Candidates]  (active — rose pill)
 *     [NavItem Settings]
 *   [Subsection: "Departments" + items w/ colored dot]
 *   ...
 *   [Footer: promo card + user card]
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
        // Static full-height sidebar — fills the panel vertically,
        // never scrolls as a whole, only its overflow area can scroll
        // if the nav list is too tall.
        'sticky top-0 flex h-full max-h-full shrink-0 flex-col pb-5',
        'w-[244px] px-4 pt-6',
        className,
      )}
      style={{
        backgroundColor: 'hsl(36 18% 96%)', // subtly cooler than main canvas
      }}
      {...props}
    >
      {brand ? <div className="px-2 pb-5">{brand}</div> : null}

      {/* Primary group title */}
      <div className="px-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-clay-ink leading-none">
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

      {/* Sub-groups */}
      <div className="mt-7 flex flex-col gap-5">
        {rest.map((group, i) => (
          <div key={i}>
            {group.title ? (
              <div className="flex items-center justify-between px-2.5 pb-2">
                <span className="clay-section-label">{group.title}</span>
                {group.addable ? (
                  <button
                    type="button"
                    onClick={group.onAdd}
                    aria-label={`Add ${group.title}`}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-clay-ink-soft hover:bg-clay-surface hover:text-clay-ink transition-colors"
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

      {/* Footer — promo + user card sit flush at the bottom of the column */}
      {footer ? (
        <div className="mt-auto flex flex-col gap-3 pt-6">{footer}</div>
      ) : null}
    </aside>
  );
}

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
        className="clay-nav-item w-full"
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
      className="clay-nav-item w-full"
    >
      {content}
    </button>
  );
}
