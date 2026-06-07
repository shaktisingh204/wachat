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

import { cn } from "@/components/sabcrm/20ui/composites/lib/cn";
import { Button } from "@/components/sabcrm/20ui/composites/button";
import { Input } from "@/components/sabcrm/20ui/composites/input";
import {
  DropdownMenu,
  SabDropdownMenuContent,
  SabDropdownMenuItem,
  SabDropdownMenuTrigger,
} from "@/components/sabcrm/20ui/composites/dropdown-menu";

import type { SabFileView } from "./types";

export interface SabFileToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  view: SabFileView;
  onViewChange: (view: SabFileView) => void;
  onUpload?: () => void;
  onNewFolder?: () => void;
  /** Selected file count (drives bulk actions slot). */
  selectionCount?: number;
  onClearSelection?: () => void;
  onDeleteSelection?: () => void;
  className?: string;
}

export function SabFileToolbar({
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
}: SabFileToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2",
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
        <div className="flex items-center gap-2 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] px-2 py-1 text-xs text-[var(--st-text)]">
          <span className="font-medium">{selectionCount} selected</span>
          {onDeleteSelection && (
            <DropdownMenu>
              <SabDropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  Bulk action
                </Button>
              </SabDropdownMenuTrigger>
              <SabDropdownMenuContent>
                <SabDropdownMenuItem destructive onClick={onDeleteSelection}>
                  <Trash2 /> Delete selected
                </SabDropdownMenuItem>
              </SabDropdownMenuContent>
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
        <div className="inline-flex rounded-[var(--st-radius)] border border-[var(--st-border)] p-0.5">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => onViewChange("grid")}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]",
              view === "grid" && "bg-[var(--st-bg-muted)] text-[var(--st-text)]",
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
              "inline-flex h-7 w-7 items-center justify-center rounded-[var(--st-radius-sm)] text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]",
              view === "list" && "bg-[var(--st-bg-muted)] text-[var(--st-text)]",
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
