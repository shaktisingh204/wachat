"use client";

import * as React from "react";
import { Copy, Link as LinkIcon, Mail } from "lucide-react";

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
import {
  ZoruSelect,
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
    <ZoruDialog open={!!file} onOpenChange={onOpenChange}>
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
                <ZoruLabel htmlFor="zoru-share-email">Invite by email</ZoruLabel>
                <div className="flex gap-2">
                  <ZoruInput
                    id="zoru-share-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    leadingSlot={<Mail />}
                    className="flex-1"
                  />
                  <ZoruSelect value={access} onValueChange={(v) => setAccess(v as ZoruFileShareAccess)}>
                    <ZoruSelectTrigger className="w-32">
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="viewer">Viewer</ZoruSelectItem>
                      <ZoruSelectItem value="editor">Editor</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                  <ZoruButton
                    onClick={() => {
                      if (!email.trim()) return;
                      onInvite?.(file, email.trim(), access);
                      setEmail("");
                    }}
                  >
                    Invite
                  </ZoruButton>
                </div>
              </div>

              {shareUrl && (
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>Shareable link</ZoruLabel>
                  <div className="flex gap-2">
                    <ZoruInput
                      readOnly
                      value={shareUrl}
                      leadingSlot={<LinkIcon />}
                      className="flex-1"
                    />
                    <ZoruButton
                      variant="outline"
                      onClick={() => onCopyLink?.(shareUrl)}
                    >
                      <Copy /> Copy
                    </ZoruButton>
                  </div>
                </div>
              )}
            </div>

            <ZoruDialogFooter>
              <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
                Done
              </ZoruButton>
            </ZoruDialogFooter>
          </>
        )}
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
