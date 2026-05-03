"use client";

import * as React from "react";

import { ZoruButton } from "../button";
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "../dialog";
import {
  ZoruFileUploadCard,
  type ZoruFileUploadItem,
} from "../file-upload-card";

export interface ZoruFileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: ZoruFileUploadItem[];
  onFilesSelected: (files: File[]) => void;
  onRemove?: (id: string) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  hint?: React.ReactNode;
  /** Called when the user clicks "Done". */
  onDone?: () => void;
}

export function ZoruFileUploadDialog({
  open,
  onOpenChange,
  items,
  onFilesSelected,
  onRemove,
  accept,
  multiple = true,
  maxSize,
  hint,
  onDone,
}: ZoruFileUploadDialogProps) {
  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-xl">
        <ZoruDialogHeader>
          <ZoruDialogTitle>Upload files</ZoruDialogTitle>
          <ZoruDialogDescription>
            Drag-and-drop or browse to add files to this folder.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <ZoruFileUploadCard
          accept={accept}
          multiple={multiple}
          maxSize={maxSize}
          hint={hint}
          items={items}
          onFilesSelected={onFilesSelected}
          onRemove={onRemove}
        />
        <ZoruDialogFooter>
          <ZoruButton
            onClick={() => {
              onDone?.();
              onOpenChange(false);
            }}
          >
            Done
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
