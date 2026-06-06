"use client";

import * as React from "react";
import { Bookmark, BookmarkPlus, Pin, PinOff, Trash2 } from "lucide-react";

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  Label,
} from "@/components/zoruui";

import { useSabsmsUrlState } from "./use-sabsms-url-state";

/**
 * Saved views = named snapshots of the querystring for a page.
 *
 * Phase 1 stores views in localStorage keyed by `sabsms:savedViews:<scope>`.
 * Phase 11 can move them to a Mongo collection for cross-device sync.
 */

export interface SabsmsSavedView {
  id: string;
  name: string;
  query: string;
  pinned: boolean;
}

export interface SabsmsSavedViewsProps {
  /** Distinct key per page so views don't bleed between routes. */
  scope: string;
}

function storageKey(scope: string) {
  return `sabsms:savedViews:${scope}`;
}

function loadViews(scope: string): SabsmsSavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is SabsmsSavedView =>
        typeof v?.id === "string" &&
        typeof v?.name === "string" &&
        typeof v?.query === "string",
    );
  } catch {
    return [];
  }
}

function persist(scope: string, views: SabsmsSavedView[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(scope), JSON.stringify(views));
}

export function SabsmsSavedViews({ scope }: SabsmsSavedViewsProps) {
  const url = useSabsmsUrlState();
  const [views, setViews] = React.useState<SabsmsSavedView[]>([]);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [name, setName] = React.useState("");

  React.useEffect(() => setViews(loadViews(scope)), [scope]);

  function commit(next: SabsmsSavedView[]) {
    setViews(next);
    persist(scope, next);
  }

  function saveCurrent() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const view: SabsmsSavedView = {
      id: crypto.randomUUID(),
      name: trimmed,
      query: url.toString(),
      pinned: false,
    };
    commit([view, ...views]);
    setName("");
    setSaveOpen(false);
  }

  function apply(view: SabsmsSavedView) {
    const params = new URLSearchParams(view.query);
    const next: Record<string, string | string[]> = {};
    for (const key of new Set(Array.from(params.keys()))) {
      next[key] = params.getAll(key);
    }
    url.set(next);
  }

  function togglePin(id: string) {
    commit(
      views.map((v) => (v.id === id ? { ...v, pinned: !v.pinned } : v)),
    );
  }

  function remove(id: string) {
    commit(views.filter((v) => v.id !== id));
  }

  const pinned = views.filter((v) => v.pinned);
  const rest = views.filter((v) => !v.pinned);

  return (
    <>
      <DropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="mr-1.5 h-3.5 w-3.5" />
            Views
            {pinned.length > 0 && (
              <span className="ml-1.5 text-xs text-[var(--st-text)]">
                ({pinned.length} pinned)
              </span>
            )}
          </Button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent align="end" className="w-64">
          <ZoruDropdownMenuLabel>Saved views</ZoruDropdownMenuLabel>
          <ZoruDropdownMenuSeparator />
          {views.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-[var(--st-text)]">
              No views saved yet.
            </div>
          )}
          {pinned.map((v) => (
            <ViewRow
              key={v.id}
              view={v}
              onApply={apply}
              onTogglePin={togglePin}
              onRemove={remove}
            />
          ))}
          {pinned.length > 0 && rest.length > 0 && <ZoruDropdownMenuSeparator />}
          {rest.map((v) => (
            <ViewRow
              key={v.id}
              view={v}
              onApply={apply}
              onTogglePin={togglePin}
              onRemove={remove}
            />
          ))}
          <ZoruDropdownMenuSeparator />
          <ZoruDropdownMenuItem onSelect={() => setSaveOpen(true)}>
            <BookmarkPlus className="mr-2 h-4 w-4" /> Save current view…
          </ZoruDropdownMenuItem>
        </ZoruDropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Save current view</ZoruDialogTitle>
            <ZoruDialogDescription>
              Captures every filter, sort, and date range in the URL.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sabsms-view-name">Name</Label>
            <Input
              id="sabsms-view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High-priority failures last 24h"
              autoFocus
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrent} disabled={!name.trim()}>
              Save
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </>
  );
}

function ViewRow({
  view,
  onApply,
  onTogglePin,
  onRemove,
}: {
  view: SabsmsSavedView;
  onApply: (v: SabsmsSavedView) => void;
  onTogglePin: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-1 px-2 py-1.5 text-sm hover:bg-[var(--st-bg-muted)]">
      <button
        type="button"
        className="flex-1 truncate text-left"
        onClick={() => onApply(view)}
      >
        {view.name}
      </button>
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(view.id);
        }}
        aria-label={view.pinned ? "Unpin view" : "Pin view"}
      >
        {view.pinned ? (
          <PinOff className="h-3.5 w-3.5 text-[var(--st-text)]" />
        ) : (
          <Pin className="h-3.5 w-3.5 text-[var(--st-text)]" />
        )}
      </button>
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(view.id);
        }}
        aria-label="Delete view"
      >
        <Trash2 className="h-3.5 w-3.5 text-[var(--st-text)]" />
      </button>
    </div>
  );
}
