"use client";

import * as React from "react";
import { m, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";

import { cn } from "./lib/cn";
import { SabKbd } from "./kbd";

export interface SabActionSearchAction {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: React.ReactNode;
  meta?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
}

export interface SabActionSearchBarProps {
  actions: SabActionSearchAction[];
  placeholder?: string;
  /** Filter callback. Defaults to a case-insensitive substring match on `label`. */
  filter?: (action: SabActionSearchAction, query: string) => boolean;
  className?: string;
  /** Hint shown when the input is empty. */
  emptyHint?: React.ReactNode;
  onSelect?: (action: SabActionSearchAction) => void;
}

/**
 * SabActionSearchBar — single-line search input that reveals a
 * results panel as the user types. Lighter than the full command
 * palette — drop into headers / hero sections.
 */
export function SabActionSearchBar({
  actions,
  placeholder = "Search actions…",
  filter,
  className,
  emptyHint,
  onSelect,
}: SabActionSearchBarProps) {
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    const fn =
      filter ??
      ((a: SabActionSearchAction) =>
        String(a.label).toLowerCase().includes(q));
    return actions.filter((a) => fn(a, q));
  }, [actions, query, filter]);

  const showPanel = focused && (query.length > 0 || actions.length > 0);

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-md", className)}>
      <div
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 transition-colors",
          focused && "border-[var(--st-text)]",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-[var(--st-text)] placeholder:text-[var(--st-text-tertiary)] focus:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => setQuery("")}
            className="rounded-[4px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {!query && <SabKbd>⌘K</SabKbd>}
      </div>

      <AnimatePresence>
        {showPanel && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1 shadow-[var(--st-shadow-md)]"
          >
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--st-text-secondary)]">
                {emptyHint ?? "No matches."}
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {matches.map((action) => {
                  const handleSelect = () => {
                    action.onSelect?.();
                    onSelect?.(action);
                    if (action.href) window.location.href = action.href;
                    setFocused(false);
                  };
                  return (
                    <li key={action.id}>
                      <button
                        type="button"
                        onClick={handleSelect}
                        className="flex w-full items-center gap-2 rounded-[var(--st-radius-sm)] px-2 py-1.5 text-left text-sm text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-muted)] focus-visible:bg-[var(--st-bg-muted)] focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--st-text-secondary)]"
                      >
                        {action.icon}
                        <span className="flex-1 truncate">{action.label}</span>
                        {action.meta && (
                          <span className="text-xs text-[var(--st-text-secondary)]">
                            {action.meta}
                          </span>
                        )}
                        {action.shortcut && (
                          <span className="text-[11px] text-[var(--st-text-tertiary)]">
                            {action.shortcut}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
