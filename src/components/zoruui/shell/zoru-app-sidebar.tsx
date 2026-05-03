"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "../lib/cn";
import {
  ZoruCollapsible,
  ZoruCollapsibleContent,
  ZoruCollapsibleTrigger,
} from "../collapsible";
import { ChevronDown } from "lucide-react";

export interface ZoruSidebarLeaf {
  id: string;
  label: string;
  href?: string;
  active?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
}

export interface ZoruSidebarGroup {
  id: string;
  label?: string;
  defaultOpen?: boolean;
  items: ZoruSidebarLeaf[];
}

export interface ZoruAppSidebarProps {
  /** Section heading rendered at the top — usually the current module name. */
  heading?: React.ReactNode;
  /** Optional caption rendered under the heading. */
  caption?: React.ReactNode;
  /** Sidebar nav groups. Each group has an optional collapsible label. */
  groups: ZoruSidebarGroup[];
  /** Optional footer slot. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Module sidebar — 240px-wide column with grouped, optionally
 * collapsible nav items. Generic — pass your own groups; do not bake
 * project routes in here.
 */
export function ZoruAppSidebar({
  heading,
  caption,
  groups,
  footer,
  className,
}: ZoruAppSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-60 shrink-0 flex-col border-r border-zoru-line bg-zoru-bg",
        className,
      )}
    >
      {(heading || caption) && (
        <div className="flex flex-col gap-0.5 px-4 pb-3 pt-4">
          {heading && (
            <p className="text-sm font-semibold text-zoru-ink">{heading}</p>
          )}
          {caption && (
            <p className="text-xs text-zoru-ink-muted">{caption}</p>
          )}
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((group) => (
          <SidebarGroup key={group.id} group={group} />
        ))}
      </nav>
      {footer && <div className="border-t border-zoru-line p-3">{footer}</div>}
    </aside>
  );
}

function SidebarGroup({ group }: { group: ZoruSidebarGroup }) {
  if (!group.label) {
    return (
      <div className="mb-2 flex flex-col gap-0.5">
        {group.items.map((item) => (
          <SidebarLeaf key={item.id} item={item} />
        ))}
      </div>
    );
  }

  return (
    <ZoruCollapsible defaultOpen={group.defaultOpen ?? true} className="mb-1">
      <ZoruCollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle hover:text-zoru-ink-muted [&[data-state=open]>svg]:rotate-180 focus-visible:outline-none"
        >
          <span>{group.label}</span>
          <ChevronDown className="h-3 w-3 transition-transform duration-200" />
        </button>
      </ZoruCollapsibleTrigger>
      <ZoruCollapsibleContent>
        <div className="mt-0.5 flex flex-col gap-0.5">
          {group.items.map((item) => (
            <SidebarLeaf key={item.id} item={item} />
          ))}
        </div>
      </ZoruCollapsibleContent>
    </ZoruCollapsible>
  );
}

function SidebarLeaf({ item }: { item: ZoruSidebarLeaf }) {
  const className = cn(
    "group flex items-center gap-2 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm text-zoru-ink-muted transition-colors",
    "hover:bg-zoru-surface-2 hover:text-zoru-ink",
    item.active && "bg-zoru-surface-2 text-zoru-ink font-medium",
    "focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-zoru-ink-muted",
    item.active && "[&_svg]:text-zoru-ink",
  );

  const inner = (
    <>
      {item.icon}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zoru-surface-3 px-1 text-[10px] font-semibold text-zoru-ink-muted group-hover:text-zoru-ink">
          {item.badge}
        </span>
      )}
    </>
  );

  return item.href ? (
    <Link href={item.href} className={className} onClick={item.onClick}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={item.onClick} className={className}>
      {inner}
    </button>
  );
}
