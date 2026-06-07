"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react";

import { cn } from "../lib/cn";
import { Button } from "../button";
import { Input } from "../input";
import { Popover, SabPopoverContent, SabPopoverTrigger } from "../popover";

export interface DynamicSelectorOption {
  id: string;
  label: string;
  description?: string;
  badge?: React.ReactNode;
}

export interface SabDynamicSelectorProps {
  /** Loader for existing options. Called with the current search query. */
  fetchOptions: (search: string) => Promise<DynamicSelectorOption[]>;
  /** Currently selected option id (controlled). */
  value: string | null;
  /** Called when the user picks a different option. */
  onChange: (id: string, option: DynamicSelectorOption) => void;
  /**
   * Optional create handler. When provided AND no exact match for the
   * search query exists, a "Create '<query>'" row appears at the
   * bottom of the dropdown. The handler must return the newly created
   * option (with its real id) so it can be auto-selected.
   */
  onCreate?: (label: string) => Promise<DynamicSelectorOption>;
  /** Label shown in the trigger when nothing is selected. */
  placeholder?: string;
  /** Heading text inside the popover. */
  searchPlaceholder?: string;
  /** Empty-state copy. */
  emptyMessage?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Block widths to span its container. */
  block?: boolean;
  /** Optional pre-loaded label so the trigger doesn't show only an id. */
  selectedLabel?: string | null;
}

export function SabDynamicSelector({
  fetchOptions,
  value,
  onChange,
  onCreate,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches.",
  className,
  disabled,
  block = true,
  selectedLabel,
}: SabDynamicSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<DynamicSelectorOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [labelCache, setLabelCache] = React.useState<string | null>(selectedLabel ?? null);

  React.useEffect(() => {
    setLabelCache(selectedLabel ?? null);
  }, [selectedLabel]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetchOptions(query);
        if (!cancelled) setOptions(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, query, fetchOptions]);

  // Cache labels we've seen so the trigger keeps a friendly label even
  // when the popover is closed and `options` has been replaced by a
  // narrower search.
  React.useEffect(() => {
    if (!value) return;
    const hit = options.find((o) => o.id === value);
    if (hit) setLabelCache(hit.label);
  }, [value, options]);

  const exactMatch = options.some(
    (o) => o.label.toLowerCase().trim() === query.toLowerCase().trim(),
  );
  const showCreate = !!onCreate && query.trim().length > 0 && !exactMatch;

  const handleCreate = async () => {
    if (!onCreate) return;
    setCreating(true);
    setError(null);
    try {
      const created = await onCreate(query.trim());
      onChange(created.id, created);
      setLabelCache(created.label);
      setOpen(false);
      setQuery("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SabPopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-left text-sm text-[var(--st-text)] transition-colors",
            "hover:bg-[var(--st-bg-muted)] disabled:cursor-not-allowed disabled:opacity-50",
            block && "w-full",
            className,
          )}
        >
          <span className={cn("flex-1 truncate", !value && "text-[var(--st-text-secondary)]")}>
            {value ? labelCache ?? "(selected)" : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" />
        </button>
      </SabPopoverTrigger>
      <SabPopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="border-b border-[var(--st-border)] p-2">
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leadingSlot={<Search />}
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--st-text-secondary)]" />
            </div>
          ) : options.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--st-text-secondary)]">
              {emptyMessage}
            </p>
          ) : (
            <ul className="flex flex-col">
              {options.map((opt) => {
                const selected = opt.id === value;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.id, opt);
                        setLabelCache(opt.label);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-[var(--st-radius-sm)] px-2.5 py-2 text-left text-sm",
                        "hover:bg-[var(--st-bg-muted)]",
                        selected && "bg-[var(--st-bg-muted)]",
                      )}
                    >
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          selected ? "text-[var(--st-text)]" : "text-transparent",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[var(--st-text)]">{opt.label}</p>
                        {opt.description && (
                          <p className="truncate text-xs text-[var(--st-text-secondary)]">
                            {opt.description}
                          </p>
                        )}
                      </div>
                      {opt.badge && <span className="ml-2 shrink-0">{opt.badge}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {showCreate && (
          <div className="border-t border-[var(--st-border)] p-1">
            <Button
              size="sm"
              variant="ghost"
              block
              disabled={creating}
              onClick={handleCreate}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create &ldquo;{query.trim()}&rdquo;
            </Button>
          </div>
        )}
        {error && (
          <p className="border-t border-[var(--st-border)] p-2 text-xs text-[var(--st-danger-strong)]">
            {error}
          </p>
        )}
      </SabPopoverContent>
    </Popover>
  );
}
