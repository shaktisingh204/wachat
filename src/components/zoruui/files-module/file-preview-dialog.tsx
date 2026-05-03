"use client";

import * as React from "react";

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "../dialog";

import type { ZoruFileEntity } from "./types";

export interface ZoruFilePreviewDialogProps {
  file: ZoruFileEntity | null;
  onOpenChange: (open: boolean) => void;
}

export function ZoruFilePreviewDialog({
  file,
  onOpenChange,
}: ZoruFilePreviewDialogProps) {
  return (
    <ZoruDialog open={!!file} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-3xl">
        {file && (
          <>
            <ZoruDialogHeader>
              <ZoruDialogTitle>{file.name}</ZoruDialogTitle>
              <ZoruDialogDescription>
                {[
                  file.mime,
                  file.size !== undefined && formatBytes(file.size),
                  file.modified && file.modified.toLocaleString(),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </ZoruDialogDescription>
            </ZoruDialogHeader>
            <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-surface">
              {file.thumbnailUrl || (file.mime?.startsWith("image/") && file.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.url ?? file.thumbnailUrl}
                  alt={file.name}
                  className="max-h-[60vh] w-auto object-contain"
                />
              ) : (
                <p className="p-8 text-sm text-zoru-ink-muted">
                  Preview not available for this file type.
                </p>
              )}
            </div>
          </>
        )}
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
