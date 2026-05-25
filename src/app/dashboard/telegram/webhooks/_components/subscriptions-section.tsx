"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  EmptyState,
  Label,
  Skeleton,
} from "@/components/zoruui";
import {
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Play,
  ShieldCheck,
  Trash2,
  Webhook,
} from "lucide-react";
import type { WebhookSubscriptionRow } from "@/lib/rust-client/telegram-webhooks";
import { fmtDate, maskSecret } from "./utils";

export function SubscriptionsSection({
  loading,
  error,
  subs,
  onEdit,
  onTest,
  onRotate,
  onDelete,
  onAddNew,
}: {
  loading: boolean;
  error: string | null;
  subs: WebhookSubscriptionRow[];
  onEdit: (s: WebhookSubscriptionRow) => void;
  onTest: (s: WebhookSubscriptionRow) => void;
  onRotate: (s: WebhookSubscriptionRow) => void;
  onDelete: (s: WebhookSubscriptionRow) => void;
  onAddNew: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <ZoruCardContent className="space-y-2 p-4">
              <Skeleton className="h-16 w-full" />
            </ZoruCardContent>
          </Card>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <ZoruCardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </ZoruCardContent>
      </Card>
    );
  }
  if (subs.length === 0) {
    return (
      <EmptyState
        icon={<Webhook className="h-8 w-8" />}
        title="No webhook subscriptions yet"
        description="Save a URL for one of your bots to start collecting deliveries."
        action={
          <Button onClick={onAddNew}>
            <Pencil className="mr-2 h-4 w-4" /> Configure a webhook
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {subs.map((s) => (
        <SubscriptionRow
          key={s._id}
          s={s}
          onEdit={() => onEdit(s)}
          onTest={() => onTest(s)}
          onRotate={() => onRotate(s)}
          onDelete={() => onDelete(s)}
        />
      ))}
    </div>
  );
}

function SubscriptionRow({
  s,
  onEdit,
  onTest,
  onRotate,
  onDelete,
}: {
  s: WebhookSubscriptionRow;
  onEdit: () => void;
  onTest: () => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const [showSecret, setShowSecret] = React.useState(false);
  return (
    <Card>
      <ZoruCardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">
              @{s.botUsername ?? s.botId.slice(0, 8)}
            </Badge>
            <code className="break-all rounded bg-muted px-2 py-0.5 text-xs">
              {s.url}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Max conns: {s.maxConnections}</span>
            <span>•</span>
            <span>Drop pending: {s.dropPendingUpdates ? "on" : "off"}</span>
            <span>•</span>
            <span>Last set: {fmtDate(s.lastSetAt)}</span>
            {s.pendingUpdateCount !== undefined && (
              <>
                <span>•</span>
                <span>Pending: {s.pendingUpdateCount}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {s.allowedUpdates?.map((u) => (
              <Badge key={u} variant="ghost">
                {u}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Label>Secret:</Label>
            <code className="rounded bg-muted px-2 py-0.5">
              {showSecret ? (s.secretToken ?? "—") : maskSecret(s.secretToken)}
            </code>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setShowSecret((v) => !v)}
            >
              {showSecret ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
            {s.secretToken && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(s.secretToken ?? "");
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
          {s.lastTelegramErrorMessage && (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {s.lastTelegramErrorMessage}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onTest}>
            <Play className="mr-1 h-3 w-3" /> Test
          </Button>
          <Button variant="outline" size="sm" onClick={onRotate}>
            <ShieldCheck className="mr-1 h-3 w-3" /> Rotate
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
