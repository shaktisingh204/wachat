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
import { Input } from "@/components/sabcrm/20ui/composites/input";
import { Label } from "@/components/sabcrm/20ui/composites/label";

import type { SabFileEntity } from "./types";

export interface SabFileRenameDialogProps {
  file: SabFileEntity | null;
  onOpenChange: (open: boolean) => void;
  onRename: (file: SabFileEntity, newName: string) => void | Promise<void>;
}

export function SabFileRenameDialog({
  file,
  onOpenChange,
  onRename,
}: SabFileRenameDialogProps) {
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
      <SabDialogContent>
        {file && (
          <form onSubmit={handleSubmit} className="contents">
            <SabDialogHeader>
              <SabDialogTitle>Rename file</SabDialogTitle>
              <SabDialogDescription>
                Renaming doesn&apos;t change the file&apos;s URL.
              </SabDialogDescription>
            </SabDialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="sab-file-rename">File name</Label>
              <Input
                id="sab-file-rename"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <SabDialogFooter>
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
            </SabDialogFooter>
          </form>
        )}
      </SabDialogContent>
    </Dialog>
  );
}
