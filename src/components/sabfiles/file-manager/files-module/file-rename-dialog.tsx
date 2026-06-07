"use client";

import * as React from "react";

import { Button } from "@/components/sabcrm/20ui/composites/button";
import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "@/components/sabcrm/20ui/composites/dialog";
import { Input } from "@/components/sabcrm/20ui/composites/input";
import { Label } from "@/components/sabcrm/20ui/composites/label";

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
    <Dialog open={!!file} onOpenChange={onOpenChange}>
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
              <Label htmlFor="zoru-file-rename">File name</Label>
              <Input
                id="zoru-file-rename"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <ZoruDialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </ZoruDialogFooter>
          </form>
        )}
      </ZoruDialogContent>
    </Dialog>
  );
}
