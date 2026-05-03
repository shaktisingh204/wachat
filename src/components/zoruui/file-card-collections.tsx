"use client";

import * as React from "react";
import { File, FileText, FileImage, FileVideo, FileAudio, FileArchive, MoreHorizontal } from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruButton } from "./button";

export interface ZoruFileCardItem {
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

export interface ZoruFileCardCollectionsProps {
  items: ZoruFileCardItem[];
  view?: "grid" | "list";
  onItemClick?: (item: ZoruFileCardItem) => void;
  onItemAction?: (item: ZoruFileCardItem) => void;
  className?: string;
  /** Empty-state node. */
  empty?: React.ReactNode;
}

export function ZoruFileCardCollections({
  items,
  view = "grid",
  onItemClick,
  onItemAction,
  className,
  empty,
}: ZoruFileCardCollectionsProps) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[var(--zoru-radius-lg)] border border-dashed border-zoru-line p-12 text-sm text-zoru-ink-muted",
          className,
        )}
      >
        {empty ?? "No files yet."}
      </div>
    );
  }

  if (view === "list") {
    return (
      <ul className={cn("divide-y divide-zoru-line rounded-[var(--zoru-radius-lg)] border border-zoru-line", className)}>
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-zoru-surface"
          >
            <button
              type="button"
              onClick={() => onItemClick?.(item)}
              className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none"
            >
              <FileTypeIcon mime={item.mime} className="h-4 w-4 text-zoru-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zoru-ink">
                  {item.name}
                </span>
                {(item.size !== undefined || item.modified) && (
                  <span className="block text-[11px] text-zoru-ink-muted">
                    {item.size !== undefined && formatBytes(item.size)}
                    {item.size !== undefined && item.modified && " · "}
                    {item.modified && item.modified.toLocaleDateString()}
                  </span>
                )}
              </span>
            </button>
            {onItemAction && (
              <ZoruButton
                variant="ghost"
                size="icon-sm"
                aria-label="Item actions"
                onClick={() => onItemAction(item)}
              >
                <MoreHorizontal />
              </ZoruButton>
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
          className="group flex flex-col overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg transition-shadow hover:shadow-[var(--zoru-shadow-md)]"
        >
          <button
            type="button"
            onClick={() => onItemClick?.(item)}
            className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-zoru-surface text-zoru-ink-subtle focus-visible:outline-none"
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
              <p className="truncate text-sm font-medium text-zoru-ink">
                {item.name}
              </p>
              <p className="text-[11px] text-zoru-ink-muted">
                {item.size !== undefined && formatBytes(item.size)}
                {item.size !== undefined && item.modified && " · "}
                {item.modified && item.modified.toLocaleDateString()}
              </p>
              {item.meta && <div className="mt-1">{item.meta}</div>}
            </div>
            {onItemAction && (
              <ZoruButton
                variant="ghost"
                size="icon-sm"
                aria-label="Item actions"
                onClick={() => onItemAction(item)}
              >
                <MoreHorizontal />
              </ZoruButton>
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
