"use client";

import * as React from "react";
import { File, FileText, FileImage, FileVideo, FileAudio, FileArchive, MoreHorizontal } from "lucide-react";

import { cn } from "@/components/sabcrm/20ui/composites/lib/cn";
import { Button } from "@/components/sabcrm/20ui/composites/button";

export interface SabFileCardItem {
  id: string;
  name: string;
  /** Optional thumbnail URL — rendered for images. */
  thumbnailUrl?: string;
  /** File mime type or extension; drives the default icon. */
  mime?: string;
  size?: number;
  modified?: Date;
  meta?: React.ReactNode;
}

export interface SabFileCardCollectionsProps {
  items: SabFileCardItem[];
  view?: "grid" | "list";
  onItemClick?: (item: SabFileCardItem) => void;
  onItemAction?: (item: SabFileCardItem) => void;
  className?: string;
  /** Empty-state node. */
  empty?: React.ReactNode;
}

export function SabFileCardCollections({
  items,
  view = "grid",
  onItemClick,
  onItemAction,
  className,
  empty,
}: SabFileCardCollectionsProps) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[var(--st-radius-lg)] border border-dashed border-[var(--st-border)] p-12 text-sm text-[var(--st-text-secondary)]",
          className,
        )}
      >
        {empty ?? "No files yet."}
      </div>
    );
  }

  if (view === "list") {
    return (
      <ul className={cn("divide-y divide-[var(--st-border)] rounded-[var(--st-radius-lg)] border border-[var(--st-border)]", className)}>
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--st-surface)]"
          >
            <button
              type="button"
              onClick={() => onItemClick?.(item)}
              className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none"
            >
              <FileTypeIcon mime={item.mime} className="h-4 w-4 text-[var(--st-text-secondary)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--st-text)]">
                  {item.name}
                </span>
                {(item.size !== undefined || item.modified) && (
                  <span className="block text-[11px] text-[var(--st-text-secondary)]">
                    {item.size !== undefined && formatBytes(item.size)}
                    {item.size !== undefined && item.modified && " · "}
                    {item.modified && item.modified.toLocaleDateString()}
                  </span>
                )}
              </span>
            </button>
            {onItemAction && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Item actions"
                onClick={() => onItemAction(item)}
              >
                <MoreHorizontal />
              </Button>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="group flex flex-col overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] transition-shadow hover:shadow-[var(--st-shadow-md)]"
        >
          <button
            type="button"
            onClick={() => onItemClick?.(item)}
            className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[var(--st-surface)] text-[var(--st-text-tertiary)] focus-visible:outline-none"
          >
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <FileTypeIcon mime={item.mime} className="h-8 w-8" />
            )}
          </button>
          <div className="flex items-start gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--st-text)]">
                {item.name}
              </p>
              <p className="text-[11px] text-[var(--st-text-secondary)]">
                {item.size !== undefined && formatBytes(item.size)}
                {item.size !== undefined && item.modified && " · "}
                {item.modified && item.modified.toLocaleDateString()}
              </p>
              {item.meta && <div className="mt-1">{item.meta}</div>}
            </div>
            {onItemAction && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Item actions"
                onClick={() => onItemAction(item)}
              >
                <MoreHorizontal />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FileTypeIcon({
  mime,
  className,
}: {
  mime?: string;
  className?: string;
}) {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return <FileImage className={className} />;
  if (m.startsWith("video/")) return <FileVideo className={className} />;
  if (m.startsWith("audio/")) return <FileAudio className={className} />;
  if (
    m.includes("zip") ||
    m.includes("tar") ||
    m.includes("gzip") ||
    m.includes("rar")
  )
    return <FileArchive className={className} />;
  if (
    m.startsWith("text/") ||
    m.includes("pdf") ||
    m.includes("document") ||
    m.includes("msword")
  )
    return <FileText className={className} />;
  return <File className={className} />;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
