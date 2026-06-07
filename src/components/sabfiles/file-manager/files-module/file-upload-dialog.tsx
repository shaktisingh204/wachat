"use client";

import * as React from "react";

import { Button } from "@/components/sabcrm/20ui/composites/button";
import {
  Dialog,
  SabDialogContent,
  SabDialogDescription,
  SabDialogFooter,
  SabDialogHeader,
  SabDialogTitle,
} from "@/components/sabcrm/20ui/composites/dialog";
import {
  SabFileUploadCard,
  type SabFileUploadItem,
} from "../file-upload-card";

export interface SabFileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: SabFileUploadItem[];
  onFilesSelected: (files: File[]) => void;
  onRemove?: (id: string) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  hint?: React.ReactNode;
  /** Called when the user clicks "Done". */
  onDone?: () => void;
}

export function SabFileUploadDialog({
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
}: SabFileUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SabDialogContent className="max-w-xl">
        <SabDialogHeader>
          <SabDialogTitle>Upload files</SabDialogTitle>
          <SabDialogDescription>
            Drag-and-drop or browse to add files to this folder.
          </SabDialogDescription>
        </SabDialogHeader>
        <SabFileUploadCard
          accept={accept}
          multiple={multiple}
          maxSize={maxSize}
          hint={hint}
          items={items}
          onFilesSelected={onFilesSelected}
          onRemove={onRemove}
        />
        <SabDialogFooter>
          <Button
            onClick={() => {
              onDone?.();
              onOpenChange(false);
            }}
          >
            Done
          </Button>
        </SabDialogFooter>
      </SabDialogContent>
    </Dialog>
  );
}
