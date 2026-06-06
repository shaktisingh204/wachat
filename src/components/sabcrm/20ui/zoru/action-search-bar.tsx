"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruKbd } from "./kbd";

export interface ZoruActionSearchAction {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: React.ReactNode;
  meta?: React.ReactNode;
  onSelect?: () => void;
  href?: string;
}

export interface ZoruActionSearchBarProps {
  actions: ZoruActionSearchAction[];
  placeholder?: string;
  /** Filter callback. Defaults to a case-insensitive substring match on `label`. */
  filter?: (action: ZoruActionSearchAction, query: string) => boolean;
  className?: string;
  /** Hint shown when the input is empty. */
  emptyHint?: React.ReactNode;
  onSelect?: (action: ZoruActionSearchAction) => void;
}

/**
 * ZoruActionSearchBar — single-line search input that reveals a
 * results panel as the user types. Lighter than the full command
 * palette — drop into headers / hero sections.
 */
export function ZoruActionSearchBar({
  actions,
  placeholder = "Search actions…",
  filter,
  className,
  emptyHint,
  onSelect,
}: ZoruActionSearchBarProps) {
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
      ((a: ZoruActionSearchAction) =>
        String(a.label).toLowerCase().includes(q));
    return actions.filter((a) => fn(a, q));
  }, [actions, query, filter]);

  const showPanel = focused && (query.length > 0 || actions.length > 0);

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-md", className)}>
      <div
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 transition-colors",
          focused && "border-zoru-ink",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-zoru-ink placeholder:text-zoru-ink-subtle focus:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => setQuery("")}
            className="rounded-[4px] text-zoru-ink-muted hover:text-zoru-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {!query && <ZoruKbd>⌘K</ZoruKbd>}
      </div>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1 shadow-[var(--zoru-shadow-md)]"
          >
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zoru-ink-muted">
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
                        className="flex w-full items-center gap-2 rounded-[var(--zoru-radius-sm)] px-2 py-1.5 text-left text-sm text-zoru-ink transition-colors hover:bg-zoru-surface-2 focus-visible:bg-zoru-surface-2 focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-zoru-ink-muted"
                      >
                        {action.icon}
                        <span className="flex-1 truncate">{action.label}</span>
                        {action.meta && (
                          <span className="text-xs text-zoru-ink-muted">
                            {action.meta}
                          </span>
                        )}
                        {action.shortcut && (
                          <span className="text-[11px] text-zoru-ink-subtle">
                            {action.shortcut}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
