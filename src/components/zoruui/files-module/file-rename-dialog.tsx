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
import { ZoruInput } from "../input";
import { ZoruLabel } from "../label";

import type { ZoruFileEntity } from "./types";

export interface ZoruFileRenameDialogProps {
  file: ZoruFileEntity | null;
  onOpenChange: (open: boolean) => void;
  onRename: (file: ZoruFileEntity, newName: string) => void | Promise<void>;
}

export function ZoruFileRenameDialog({
  file,
  onOpenChange,
  onRename,
}: ZoruFileRenameDialogProps) {
  const [name, setName] = React.useState(file?.name ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setName(file?.name ?? "");
  }, [file]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onRename(file, name.trim());
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ZoruDialog open={!!file} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        {file && (
          <form onSubmit={handleSubmit} className="contents">
            <ZoruDialogHeader>
              <ZoruDialogTitle>Rename file</ZoruDialogTitle>
              <ZoruDialogDescription>
                Renaming doesn&apos;t change the file&apos;s URL.
              </ZoruDialogDescription>
            </ZoruDialogHeader>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="zoru-file-rename">File name</ZoruLabel>
              <ZoruInput
                id="zoru-file-rename"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <ZoruDialogFooter>
              <ZoruButton
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={!name.trim() || submitting}>
                {submitting ? "Saving…" : "Save"}
              </ZoruButton>
            </ZoruDialogFooter>
          </form>
        )}
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
