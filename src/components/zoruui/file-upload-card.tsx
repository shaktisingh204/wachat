"use client";

import * as React from "react";
import { CloudUpload, X } from "lucide-react";

import { cn } from "./lib/cn";
import { ZoruButton } from "./button";
import { ZoruProgress } from "./progress";

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
          "flex flex-col items-center justify-center gap-2 rounded-[var(--zoru-radius-lg)] border border-dashed border-zoru-line bg-zoru-bg p-10 text-center transition-colors",
          "hover:border-zoru-line-strong hover:bg-zoru-surface",
          dragOver && "border-zoru-ink bg-zoru-surface-2",
          disabled && "cursor-not-allowed opacity-50 hover:bg-zoru-bg",
          "focus-visible:outline-none",
        )}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
          <CloudUpload className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-zoru-ink">
          Drop files here, or click to browse
        </p>
        {hint && <p className="text-xs text-zoru-ink-muted">{hint}</p>}
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
              className="flex items-center gap-3 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-zoru-ink">
                    {item.file.name}
                  </p>
                  <p className="shrink-0 text-[11px] text-zoru-ink-muted">
                    {formatBytes(item.file.size)}
                  </p>
                </div>
                {item.status === "uploading" && (
                  <ZoruProgress
                    value={item.progress ?? 60}
                    className="mt-2 h-1"
                  />
                )}
                {item.status === "error" && (
                  <p className="mt-1 text-xs text-zoru-danger">
                    {item.errorMessage ?? "Upload failed."}
                  </p>
                )}
                {item.status === "done" && (
                  <p className="mt-1 text-xs text-zoru-success">Uploaded</p>
                )}
              </div>
              {onRemove && (
                <ZoruButton
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(item.id)}
                  aria-label="Remove file"
                >
                  <X />
                </ZoruButton>
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
