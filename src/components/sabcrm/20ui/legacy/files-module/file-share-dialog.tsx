"use client";

import * as React from "react";
import { Copy, Link as LinkIcon, Mail } from "lucide-react";

import { Button } from "../button";
import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "../dialog";
import { Input } from "../input";
import { Label } from "../label";
import {
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "../select";

import type { ZoruFileEntity } from "./types";

export type ZoruFileShareAccess = "viewer" | "editor";

export interface ZoruFileShareDialogProps {
  file: ZoruFileEntity | null;
  shareUrl?: string;
  onOpenChange: (open: boolean) => void;
  onInvite?: (file: ZoruFileEntity, email: string, access: ZoruFileShareAccess) => void;
  onCopyLink?: (url: string) => void;
}

export function ZoruFileShareDialog({
  file,
  shareUrl,
  onOpenChange,
  onInvite,
  onCopyLink,
}: ZoruFileShareDialogProps) {
  const [email, setEmail] = React.useState("");
  const [access, setAccess] = React.useState<ZoruFileShareAccess>("viewer");

  React.useEffect(() => {
    setEmail("");
    setAccess("viewer");
  }, [file]);

  return (
    <Dialog open={!!file} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-md">
        {file && (
          <>
            <ZoruDialogHeader>
              <ZoruDialogTitle>Share &quot;{file.name}&quot;</ZoruDialogTitle>
              <ZoruDialogDescription>
                Invite teammates by email or copy a shareable link.
              </ZoruDialogDescription>
            </ZoruDialogHeader>

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
                  <Select value={access} onValueChange={(v) => setAccess(v as ZoruFileShareAccess)}>
                    <ZoruSelectTrigger className="w-32">
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="viewer">Viewer</ZoruSelectItem>
                      <ZoruSelectItem value="editor">Editor</ZoruSelectItem>
                    </ZoruSelectContent>
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

            <ZoruDialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </ZoruDialogFooter>
          </>
        )}
      </ZoruDialogContent>
    </Dialog>
  );
}
