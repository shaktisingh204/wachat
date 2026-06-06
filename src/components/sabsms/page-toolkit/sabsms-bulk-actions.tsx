"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from "@/components/zoruui";

export interface SabsmsBulkAction<T> {
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onSelect: (rows: T[]) => void | Promise<void>;
}

export interface SabsmsBulkActionsBarProps<T> {
  selectedCount: number;
  totalCount: number;
  rows: T[];
  actions: SabsmsBulkAction<T>[];
  onClear: () => void;
  onSelectAllMatching?: () => void;
}

export function SabsmsBulkActionsBar<T>({
  selectedCount,
  totalCount,
  rows,
  actions,
  onClear,
  onSelectAllMatching,
}: SabsmsBulkActionsBarProps<T>) {
  const primary = actions.slice(0, 2);
  const overflow = actions.slice(2);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm">
      <Check className="h-4 w-4 text-[var(--st-text)]" />
      <span className="font-medium text-[var(--st-text)]">
        {selectedCount.toLocaleString()} selected
      </span>
      {onSelectAllMatching && selectedCount < totalCount && (
        <Button
          variant="link"
          size="sm"
          className="h-auto px-1 text-[var(--st-text)]"
          onClick={onSelectAllMatching}
        >
          Select all {totalCount.toLocaleString()} matching
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {primary.map((a) => (
          <Button
            key={a.label}
            variant={a.destructive ? "destructive" : "outline"}
            size="sm"
            onClick={() => a.onSelect(rows)}
          >
            {a.icon}
            <span className={a.icon ? "ml-1.5" : undefined}>{a.label}</span>
          </Button>
        ))}
        {overflow.length > 0 && (
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                More
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              {overflow.map((a) => (
                <ZoruDropdownMenuItem
                  key={a.label}
                  onSelect={() => a.onSelect(rows)}
                  destructive={a.destructive}
                >
                  {a.icon}
                  <span className={a.icon ? "ml-2" : undefined}>{a.label}</span>
                </ZoruDropdownMenuItem>
              ))}
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
