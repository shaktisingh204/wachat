"use client";

import * as React from "react";

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "../dialog";

import { getSharePreviewKind } from "@/lib/sabfiles/share-ui";
import type { ZoruFileEntity } from "./types";

function officePreviewUrl(url: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export interface ZoruFilePreviewDialogProps {
  file: ZoruFileEntity | null;
  onOpenChange: (open: boolean) => void;
}

export function ZoruFilePreviewDialog({
  file,
  onOpenChange,
}: ZoruFilePreviewDialogProps) {
  const previewKind = getSharePreviewKind(file?.mime);
  const previewUrl = file ? file.url ?? file.thumbnailUrl ?? `/api/sabfiles/preview/${file.id}` : undefined;

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
              {previewKind === "image" && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="max-h-[60vh] w-auto object-contain"
                />
              ) : previewKind === "video" && previewUrl ? (
                <video
                  src={previewUrl}
                  className="max-h-[60vh] w-full bg-black"
                  controls
                  preload="metadata"
                />
              ) : previewKind === "audio" && previewUrl ? (
                <div className="w-full p-8">
                  <audio src={previewUrl} className="w-full" controls preload="metadata" />
                </div>
              ) : previewKind === "document" && previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={file.name}
                  className="h-[60vh] w-full border-0 bg-white"
                />
              ) : previewKind === "office" && previewUrl ? (
                <iframe
                  src={officePreviewUrl(previewUrl)}
                  title={file.name}
                  className="h-[60vh] w-full border-0 bg-white"
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
