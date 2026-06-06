"use client";

import * as React from "react";
import {
  Button,
  IconButton,
  Checkbox,
  Switch,
  Slider,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/sabcrm/20ui";
import { Eye, EyeOff } from "lucide-react";
import type { WebhookSubscriptionRow } from "@/lib/rust-client/telegram-webhooks";
import { TELEGRAM_ALLOWED_UPDATES } from "@/lib/rust-client/telegram-webhooks-shared";
import { putTelegramWebhookSubscriptionAction } from "@/app/actions/telegram-webhooks.actions";

export function SubscriptionDrawer({
  open,
  onClose,
  projectId,
  subs,
  editing,
  onSaved,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  subs: WebhookSubscriptionRow[];
  editing: WebhookSubscriptionRow | null;
  onSaved: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const [url, setUrl] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [allowed, setAllowed] = React.useState<string[]>([]);
  const [maxConns, setMaxConns] = React.useState(40);
  const [dropPending, setDropPending] = React.useState(false);
  const [showSecret, setShowSecret] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [botId, setBotId] = React.useState("");

  React.useEffect(() => {
    if (!editing) return;
    setUrl(editing.url ?? "");
    setSecret(editing.secretToken ?? "");
    setAllowed(editing.allowedUpdates ?? []);
    setMaxConns(editing.maxConnections ?? 40);
    setDropPending(editing.dropPendingUpdates ?? false);
    setBotId(editing.botId ?? "");
    setShowSecret(false);
  }, [editing]);

  async function save() {
    if (!botId) {
      onError("Pick a bot to attach this webhook to.");
      return;
    }
    if (!/^https:\/\//i.test(url)) {
      onError("URL must start with https://");
      return;
    }
    setSaving(true);
    try {
      const res = await putTelegramWebhookSubscriptionAction(botId, {
        projectId,
        url,
        secretToken: secret || undefined,
        allowedUpdates: allowed,
        maxConnections: maxConns,
        dropPendingUpdates: dropPending,
      });
      if (res.success) {
        await onSaved();
      } else {
        onError(res.error ?? "unknown error");
      }
    } finally {
      setSaving(false);
    }
  }

  function toggle(v: string) {
    setAllowed((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    );
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {editing?._id
              ? "Edit webhook subscription"
              : "New webhook subscription"}
          </DrawerTitle>
          <DrawerDescription>
            Calls Telegram setWebhook with these settings and persists them
            locally.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 p-4">
          {!editing?._id && (
            <Field
              label="Bot"
              help={
                subs.length === 0
                  ? "No bots configured yet. Connect one under Telegram Bots first."
                  : undefined
              }
            >
              <Select value={botId} onValueChange={setBotId}>
                <SelectTrigger aria-label="Bot">
                  <SelectValue placeholder="Pick a bot..." />
                </SelectTrigger>
                <SelectContent>
                  {subs.map((s) => (
                    <SelectItem key={s.botId} value={s.botId}>
                      @{s.botUsername ?? s.botId.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="URL (https only)">
            <Input
              placeholder="https://example.com/api/telegram/webhook/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <Field label="Secret token">
            <div className="flex items-center gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="(generated if empty)"
              />
              <IconButton
                label={showSecret ? "Hide secret token" : "Show secret token"}
                icon={showSecret ? EyeOff : Eye}
                variant="ghost"
                size="sm"
                onClick={() => setShowSecret((v) => !v)}
              />
            </div>
          </Field>
          <Field
            label={`Allowed updates (${allowed.length} of ${TELEGRAM_ALLOWED_UPDATES.length})`}
          >
            <div className="grid grid-cols-2 gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 sm:grid-cols-3">
              {TELEGRAM_ALLOWED_UPDATES.map((u) => (
                <Checkbox
                  key={u}
                  size="sm"
                  label={u}
                  checked={allowed.includes(u)}
                  onChange={() => toggle(u)}
                  className="text-xs"
                />
              ))}
            </div>
          </Field>
          <Field label={`Max connections: ${maxConns}`}>
            <Slider
              min={1}
              max={100}
              value={maxConns}
              onValueChange={(v) =>
                setMaxConns(Array.isArray(v) ? v[0] : v)
              }
              ariaLabel="Max connections"
            />
          </Field>
          <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
            <div>
              <div className="text-sm font-medium text-[var(--st-text)]">
                Drop pending updates
              </div>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Discard updates Telegram queued before the new webhook was set.
              </p>
            </div>
            <Switch
              checked={dropPending}
              onCheckedChange={setDropPending}
              aria-label="Drop pending updates"
            />
          </div>
        </div>
        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
