"use client";

import * as React from "react";
import { Save, Settings as SettingsIcon } from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@/components/sabcrm/20ui";
import type { SabmailAccountRow } from "@/app/actions/sabmail-projects.actions";
import { RichTextEditor } from "@/app/sabmail/_components/rich-text-editor";
import { SuccessCheck } from "@/components/sabmail/motion";

import {
  saveSabmailSettings,
  type SabmailSettingsDoc,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

// Sentinel for the "no default" Select option (Radix Select can't take "").
const NO_DEFAULT = "__none__";

export function SabmailSettingsClient({
  initialSettings,
  accounts,
}: {
  initialSettings: SabmailSettingsDoc;
  accounts: SabmailAccountRow[];
}) {
  const { toast } = useToast();

  const [defaultFrom, setDefaultFrom] = React.useState<string>(
    initialSettings.defaultFromAccountId ?? NO_DEFAULT,
  );
  const [blockImages, setBlockImages] = React.useState<string>(
    initialSettings.blockRemoteImages ? "yes" : "no",
  );
  const signatureRef = React.useRef<string>(initialSettings.signatureHtml ?? "");
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(initialSettings.updatedAt);
  const [justSaved, setJustSaved] = React.useState(false);

  const onSignatureChange = React.useCallback((html: string) => {
    signatureRef.current = html;
  }, []);

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    setJustSaved(false);
    const res = await saveSabmailSettings({
      defaultFromAccountId: defaultFrom === NO_DEFAULT ? null : defaultFrom,
      signatureHtml: signatureRef.current,
      blockRemoteImages: blockImages === "yes",
    });
    setSaving(false);
    if (!res.ok) {
      toast({
        title: "Could not save settings",
        description: res.error,
        variant: "destructive",
      });
      return;
    }
    setSavedAt(res.settings.updatedAt);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1600);
    toast({ title: "Settings saved" });
  }, [defaultFrom, blockImages, toast]);

  return (
    <div className="sabmail-canvas min-h-full p-4 sm:p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--st-text)]">Settings</h1>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
              Defaults for this workspace — the From mailbox used when composing,
              your signature, and how remote images are handled.
            </p>
          </div>
        </div>

        <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" aria-hidden />
              Mail preferences
            </CardTitle>
            <CardDescription>
              {savedAt
                ? `Last saved ${new Date(savedAt).toLocaleString()}`
                : "Not saved yet"}
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-6">
            <Field
              label="Default from account"
              error={undefined}
            >
              {accounts.length === 0 ? (
                <p className="text-sm text-[var(--st-text-secondary)]">
                  Connect a mailbox under Accounts to pick a default sender.
                </p>
              ) : (
                <Select value={defaultFrom} onValueChange={setDefaultFrom}>
                  <SelectTrigger>
                    <SelectValue placeholder="No default — choose per message" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DEFAULT}>
                      No default — choose per message
                    </SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName ? `${a.displayName} · ${a.email}` : a.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Signature">
              <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2">
                <RichTextEditor
                  initialHtml={initialSettings.signatureHtml ?? ""}
                  onChange={onSignatureChange}
                  placeholder="Add a signature appended to your messages…"
                  ariaLabel="Email signature"
                />
              </div>
            </Field>

            <Field label="Block remote images">
              <Select value={blockImages} onValueChange={setBlockImages}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">
                    Yes — block until I choose to load them
                  </SelectItem>
                  <SelectItem value="no">No — always load remote images</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-[var(--st-text-secondary)]">
                Blocking remote images protects privacy by preventing tracking
                pixels from loading automatically.
              </p>
            </Field>

            <div className="flex items-center justify-end gap-3 pt-2">
              {justSaved ? (
                <SuccessCheck size={28} label="Saved" />
              ) : null}
              <Button
                variant="primary"
                size="sm"
                iconLeft={Save}
                loading={saving}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                Save settings
              </Button>
            </div>
          </CardBody>
        </Card>
        </div>
      </div>
    </div>
  );
}
