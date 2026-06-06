"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "../lib/cn";
import {
  ZoruCollapsible,
  ZoruCollapsibleContent,
  ZoruCollapsibleTrigger,
} from "../collapsible";
import { Input } from "../input";
import { ChevronDown, Search, X } from "lucide-react";

export interface ZoruSidebarLeaf {
  id: string;
  label: string;
  href?: string;
  active?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  children?: ZoruSidebarLeaf[];
  defaultOpen?: boolean;
  /**
   * Restrict the entry to the tenant owner / admin role (Worksuite parity).
   * Filtered out for invited team members in `zoru-home-shell` before render.
   */
  adminOnly?: boolean;
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
  /** Hide the in-sidebar search input. Defaults to false (search shown). */
  hideSearch?: boolean;
  /** Placeholder for the search input. Should reflect the active module. */
  searchPlaceholder?: string;
}

/**
 * Module sidebar — 240px-wide column with grouped, optionally
 * collapsible nav items. Generic — pass your own groups; do not bake
 * project routes in here.
 */
interface SuggestionHit {
  item: ZoruSidebarLeaf;
  /** Group label + parent labels, e.g. ["HR · People", "Directory"]. */
  trail: string[];
  /** Index of the match in the lowercased label (-1 if only trail matched). */
  matchIndex: number;
}

export function ZoruAppSidebar({
  heading,
  caption,
  groups,
  footer,
  className,
  hideSearch,
  searchPlaceholder,
}: ZoruAppSidebarProps) {
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;

  const suggestions = React.useMemo<SuggestionHit[]>(
    () => (isSearching ? collectSuggestions(groups, trimmed.toLowerCase()) : []),
    [groups, trimmed, isSearching],
  );

  // Reset highlight whenever the result set changes.
  React.useEffect(() => {
    setActiveIdx(0);
  }, [trimmed]);

  const showSuggestions = isSearching && focused;

  const headingText = typeof heading === "string" ? heading : undefined;
  const placeholder =
    searchPlaceholder ??
    (headingText ? `Search ${headingText}…` : "Search this module…");

  const closeSuggestions = () => {
    setQuery("");
    setFocused(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Escape") closeSuggestions();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      const hit = suggestions[activeIdx];
      if (!hit) return;
      if (hit.item.href) {
        // Let the Link handle navigation by clicking it programmatically.
        e.preventDefault();
        const anchor = document.getElementById(suggestionId(hit.item.id));
        anchor?.click();
        closeSuggestions();
      } else if (hit.item.onClick) {
        e.preventDefault();
        hit.item.onClick();
        closeSuggestions();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSuggestions();
    }
  };

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
      {!hideSearch && (
        <div className="relative px-3 pb-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            // Delay so a click on a suggestion fires before the panel unmounts.
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="zoru-sidebar-suggestions"
            aria-autocomplete="list"
            leadingSlot={<Search />}
            trailingSlot={
              isSearching ? (
                <button
                  type="button"
                  // Use onMouseDown so the click registers before the input blur.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery("");
                  }}
                  aria-label="Clear search"
                  className="rounded-sm text-zoru-ink-subtle hover:text-zoru-ink focus-visible:outline-none"
                >
                  <X className="size-4" />
                </button>
              ) : undefined
            }
            className="text-[13px]"
          />
          {showSuggestions && (
            <div
              id="zoru-sidebar-suggestions"
              role="listbox"
              className="absolute left-3 right-3 top-[calc(100%-0.25rem)] z-30 max-h-80 overflow-y-auto rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg shadow-[var(--zoru-shadow-lg)]"
            >
              {suggestions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-zoru-ink-subtle">
                  No matches for &ldquo;{trimmed}&rdquo;
                </p>
              ) : (
                <ul className="py-1">
                  {suggestions.map((hit, i) => (
                    <SuggestionRow
                      key={hit.item.id}
                      hit={hit}
                      query={trimmed}
                      active={i === activeIdx}
                      onHover={() => setActiveIdx(i)}
                      onSelect={closeSuggestions}
                    />
                  ))}
                </ul>
              )}
            </div>
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

const suggestionId = (leafId: string) => `zoru-sb-sug-${leafId}`;

function SuggestionRow({
  hit,
  query,
  active,
  onHover,
  onSelect,
}: {
  hit: SuggestionHit;
  query: string;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const { item, trail } = hit;
  const trailText = trail.join(" · ");
  const content = (
    <div
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-zoru-ink-muted",
        "hover:bg-zoru-surface-2 hover:text-zoru-ink",
        active && "bg-zoru-surface-2 text-zoru-ink",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-zoru-ink-muted",
      )}
    >
      {item.icon}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {highlight(item.label, query)}
        </div>
        {trailText && (
          <div className="truncate text-[11px] text-zoru-ink-subtle">
            {trailText}
          </div>
        )}
      </div>
    </div>
  );

  const role = { role: "option" as const, "aria-selected": active };

  if (item.href) {
    return (
      <li {...role} onMouseEnter={onHover}>
        <Link
          id={suggestionId(item.id)}
          href={item.href}
          onClick={onSelect}
          className="block focus-visible:outline-none"
        >
          {content}
        </Link>
      </li>
    );
  }
  return (
    <li {...role} onMouseEnter={onHover}>
      <button
        type="button"
        onClick={() => {
          item.onClick?.();
          onSelect();
        }}
        className="block w-full focus-visible:outline-none"
      >
        {content}
      </button>
    </li>
  );
}

function highlight(label: string, query: string) {
  if (!query) return label;
  const lower = label.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) return label;
  const end = idx + query.length;
  return (
    <>
      {label.slice(0, idx)}
      <mark className="bg-transparent font-semibold text-zoru-ink">
        {label.slice(idx, end)}
      </mark>
      {label.slice(end)}
    </>
  );
}

/**
 * Walk every group/leaf and emit a flat hit list for items whose label
 * matches the query. Only navigable items (with href or onClick) are kept
 * — they're the things a user can actually pick from a suggestion list.
 */
function collectSuggestions(
  groups: ZoruSidebarGroup[],
  query: string,
): SuggestionHit[] {
  const hits: SuggestionHit[] = [];
  const visit = (item: ZoruSidebarLeaf, trail: string[]) => {
    const lower = item.label.toLowerCase();
    const matchIndex = lower.indexOf(query);
    const navigable = !!(item.href || item.onClick);
    if (navigable && matchIndex >= 0) {
      hits.push({ item, trail, matchIndex });
    }
    if (item.children) {
      const nextTrail = [...trail, item.label];
      for (const child of item.children) visit(child, nextTrail);
    }
  };
  for (const group of groups) {
    const trail = group.label ? [group.label] : [];
    for (const item of group.items) visit(item, trail);
  }
  // Rank: prefix matches first, then by match position, then by label length.
  hits.sort((a, b) => {
    if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
    return a.item.label.length - b.item.label.length;
  });
  return hits.slice(0, 25);
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

function SidebarLeaf({
  item,
  depth = 0,
}: {
  item: ZoruSidebarLeaf;
  depth?: number;
}) {
  const hasChildren = !!(item.children && item.children.length > 0);
  const className = cn(
    "group flex items-center gap-2 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm text-zoru-ink-muted transition-colors",
    depth > 0 && "pl-7 text-[13px]",
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
      {hasChildren && (
        <ChevronDown className="ml-auto h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      )}
    </>
  );

  if (hasChildren) {
    const childActive = item.children!.some((c) => c.active);
    return (
      <ZoruCollapsible
        defaultOpen={item.defaultOpen ?? item.active ?? childActive}
      >
        <ZoruCollapsibleTrigger asChild>
          <button type="button" className={cn(className, "group w-full")}>
            {inner}
          </button>
        </ZoruCollapsibleTrigger>
        <ZoruCollapsibleContent>
          <div className="mt-0.5 flex flex-col gap-0.5">
            {item.children!.map((child) => (
              <SidebarLeaf key={child.id} item={child} depth={depth + 1} />
            ))}
          </div>
        </ZoruCollapsibleContent>
      </ZoruCollapsible>
    );
  }

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
