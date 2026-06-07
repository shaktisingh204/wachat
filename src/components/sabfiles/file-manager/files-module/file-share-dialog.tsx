"use client";

import * as React from "react";
import { Copy, Link as LinkIcon, Mail } from "lucide-react";

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
import {
  Select,
  SabSelectContent,
  SabSelectItem,
  SabSelectTrigger,
  SabSelectValue,
} from "@/components/sabcrm/20ui/composites/select";

import type { SabFileEntity } from "./types";

export type SabFileShareAccess = "viewer" | "editor";

export interface SabFileShareDialogProps {
  file: SabFileEntity | null;
  shareUrl?: string;
  onOpenChange: (open: boolean) => void;
  onInvite?: (file: SabFileEntity, email: string, access: SabFileShareAccess) => void;
  onCopyLink?: (url: string) => void;
}

export function SabFileShareDialog({
  file,
  shareUrl,
  onOpenChange,
  onInvite,
  onCopyLink,
}: SabFileShareDialogProps) {
  const [email, setEmail] = React.useState("");
  const [access, setAccess] = React.useState<SabFileShareAccess>("viewer");

  React.useEffect(() => {
    setEmail("");
    setAccess("viewer");
  }, [file]);

  return (
    <Dialog open={!!file} onOpenChange={onOpenChange}>
      <SabDialogContent className="max-w-md">
        {file && (
          <>
            <SabDialogHeader>
              <SabDialogTitle>Share &quot;{file.name}&quot;</SabDialogTitle>
              <SabDialogDescription>
                Invite teammates by email or copy a shareable link.
              </SabDialogDescription>
            </SabDialogHeader>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="zoru-share-email">Invite by email</Label>
                <div className="flex gap-2">
                  <Input
                    id="zoru-share-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    leadingSlot={<Mail />}
                    className="flex-1"
                  />
                  <Select value={access} onValueChange={(v) => setAccess(v as SabFileShareAccess)}>
                    <SabSelectTrigger className="w-32">
                      <SabSelectValue />
                    </SabSelectTrigger>
                    <SabSelectContent>
                      <SabSelectItem value="viewer">Viewer</SabSelectItem>
                      <SabSelectItem value="editor">Editor</SabSelectItem>
                    </SabSelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      if (!email.trim()) return;
                      onInvite?.(file, email.trim(), access);
                      setEmail("");
                    }}
                  >
                    Invite
                  </Button>
                </div>
              </div>

              {shareUrl && (
                <div className="flex flex-col gap-1.5">
                  <Label>Shareable link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={shareUrl}
                      leadingSlot={<LinkIcon />}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => onCopyLink?.(shareUrl)}
                    >
                      <Copy /> Copy
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <SabDialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </SabDialogFooter>
          </>
        )}
      </SabDialogContent>
    </Dialog>
  );
}
