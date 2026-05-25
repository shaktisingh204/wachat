"use client";

import * as React from "react";
import {
  LayoutGrid,
  List,
  Search,
  Trash2,
  Upload,
  X,
  FolderPlus,
} from "lucide-react";

import { cn } from "../lib/cn";
import { Button } from "../button";
import { Input } from "../input";
import {
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from "../dropdown-menu";

import type { ZoruFileView } from "./types";

export interface ZoruFileToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  view: ZoruFileView;
  onViewChange: (view: ZoruFileView) => void;
  onUpload?: () => void;
  onNewFolder?: () => void;
  /** Selected file count (drives bulk actions slot). */
  selectionCount?: number;
  onClearSelection?: () => void;
  onDeleteSelection?: () => void;
  className?: string;
}

export function ZoruFileToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  onUpload,
  onNewFolder,
  selectionCount = 0,
  onClearSelection,
  onDeleteSelection,
  className,
}: ZoruFileToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-2",
        className,
      )}
    >
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        leadingSlot={<Search />}
        placeholder="Search files…"
        className="max-w-sm"
      />

      {selectionCount > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--zoru-radius)] bg-zoru-surface-2 px-2 py-1 text-xs text-zoru-ink">
          <span className="font-medium">{selectionCount} selected</span>
          {onDeleteSelection && (
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Bulk action
                </Button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent>
                <ZoruDropdownMenuItem destructive onClick={onDeleteSelection}>
                  <Trash2 /> Delete selected
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
          )}
          {onClearSelection && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={onClearSelection}
            >
              <X />
            </Button>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="inline-flex rounded-[var(--zoru-radius)] border border-zoru-line p-0.5">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => onViewChange("grid")}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted transition-colors hover:text-zoru-ink",
              view === "grid" && "bg-zoru-surface-2 text-zoru-ink",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted transition-colors hover:text-zoru-ink",
              view === "list" && "bg-zoru-surface-2 text-zoru-ink",
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        {onNewFolder && (
          <Button variant="outline" onClick={onNewFolder}>
            <FolderPlus /> New Folder
          </Button>
        )}
        {onUpload && (
          <Button onClick={onUpload}>
            <Upload /> Upload
          </Button>
        )}
      </div>
    </div>
  );
}
