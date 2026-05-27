"use client";

import * as React from "react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
} from "@/components/zoruui";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
    <ZoruDrawer open={open} onOpenChange={(o) => !o && onClose()}>
      <ZoruDrawerContent>
        <ZoruDrawerHeader>
          <ZoruDrawerTitle>
            {editing?._id
              ? "Edit webhook subscription"
              : "New webhook subscription"}
          </ZoruDrawerTitle>
          <ZoruDrawerDescription>
            Calls Telegram setWebhook with these settings and persists them
            locally.
          </ZoruDrawerDescription>
        </ZoruDrawerHeader>
        <div className="flex flex-col gap-4 p-4">
          {!editing?._id && (
            <div>
              <Label>Bot</Label>
              <Select value={botId} onValueChange={setBotId}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Pick a bot…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {subs.map((s) => (
                    <ZoruSelectItem key={s.botId} value={s.botId}>
                      @{s.botUsername ?? s.botId.slice(0, 8)}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
              {subs.length === 0 && (
                <p className="mt-1 text-xs text-zoru-ink-muted">
                  No bots configured yet — connect one under Telegram → Bots
                  first.
                </p>
              )}
            </div>
          )}
          <div>
            <Label>URL (https only)</Label>
            <Input
              placeholder="https://example.com/api/telegram/webhook/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <Label>Secret token</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="(generated if empty)"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div>
            <Label>
              Allowed updates ({allowed.length} of{" "}
              {TELEGRAM_ALLOWED_UPDATES.length})
            </Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-2 sm:grid-cols-3">
              {TELEGRAM_ALLOWED_UPDATES.map((u) => (
                <label
                  key={u}
                  className="flex items-center gap-2 rounded px-1 text-xs hover:bg-zoru-surface-2/50"
                >
                  <Checkbox
                    checked={allowed.includes(u)}
                    onCheckedChange={() => toggle(u)}
                  />
                  {u}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Max connections: {maxConns}</Label>
            <input
              type="range"
              min={1}
              max={100}
              value={maxConns}
              onChange={(e) => setMaxConns(parseInt(e.target.value, 10))}
              className="w-full accent-zoru-ink"
            />
          </div>
          <label className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Drop pending updates</div>
              <p className="text-xs text-zoru-ink-muted">
                Discard updates Telegram queued before the new webhook was set.
              </p>
            </div>
            <Switch checked={dropPending} onCheckedChange={setDropPending} />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </ZoruDrawerContent>
    </ZoruDrawer>
  );
}
