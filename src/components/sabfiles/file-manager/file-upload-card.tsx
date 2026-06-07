"use client";

import * as React from "react";
import { CloudUpload, X } from "lucide-react";

import { cn } from "@/components/sabcrm/20ui/composites/lib/cn";
import { Button } from "@/components/sabcrm/20ui/composites/button";
import { Progress } from "@/components/sabcrm/20ui/composites/progress";

export interface ZoruFileUploadItem {
  id: string;
  file: File;
  /** 0..100 progress. `null` for "unknown / indeterminate". */
  progress: number | null;
  status: "uploading" | "done" | "error";
  errorMessage?: string;
}

export interface ZoruFileUploadCardProps {
  /** Allowed mime types or extensions, comma-separated. */
  accept?: string;
  multiple?: boolean;
  /** Max bytes per file. */
  maxSize?: number;
  /** Hint text under the title. */
  hint?: React.ReactNode;
  /** Triggered when files are added (drop or input). */
  onFilesSelected?: (files: File[]) => void;
  /** Items currently in the upload list. */
  items?: ZoruFileUploadItem[];
  /** Triggered when the user removes an item. */
  onRemove?: (id: string) => void;
  className?: string;
  disabled?: boolean;
}

export function ZoruFileUploadCard({
  accept,
  multiple = true,
  maxSize,
  hint,
  onFilesSelected,
  items = [],
  onRemove,
  className,
  disabled,
}: ZoruFileUploadCardProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFiles = React.useCallback(
    (incoming: FileList | null) => {
      if (!incoming || disabled) return;
      let arr = Array.from(incoming);
      if (maxSize) arr = arr.filter((f) => f.size <= maxSize);
      if (!multiple) arr = arr.slice(0, 1);
      if (arr.length > 0) onFilesSelected?.(arr);
    },
    [onFilesSelected, multiple, maxSize, disabled],
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-[var(--st-radius-lg)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg)] p-10 text-center transition-colors",
          "hover:border-[var(--st-border-strong)] hover:bg-[var(--st-surface)]",
          dragOver && "border-[var(--st-text)] bg-[var(--st-bg-muted)]",
          disabled && "cursor-not-allowed opacity-50 hover:bg-[var(--st-bg)]",
          "focus-visible:outline-none",
        )}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
          <CloudUpload className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-[var(--st-text)]">
          Drop files here, or click to browse
        </p>
        {hint && <p className="text-xs text-[var(--st-text-secondary)]">{hint}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-[var(--st-text)]">
                    {item.file.name}
                  </p>
                  <p className="shrink-0 text-[11px] text-[var(--st-text-secondary)]">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
                {item.status === "uploading" && (
                  <Progress
                    value={item.progress ?? 60}
                    className="mt-2 h-1"
                  />
                )}
                {item.status === "error" && (
                  <p className="mt-1 text-xs text-[var(--st-danger)]">
                    {item.errorMessage ?? "Upload failed."}
                  </p>
                )}
                {item.status === "done" && (
                  <p className="mt-1 text-xs text-[var(--st-status-ok)]">Uploaded</p>
                )}
              </div>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(item.id)}
                  aria-label="Remove file"
                >
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
