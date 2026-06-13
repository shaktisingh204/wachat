"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/lib/utils";
import {
  Activity,
  Check,
  Copy,
  KeyRound,
  Power,
  PowerOff,
  Settings,
  Trash2,
  Webhook,
} from "lucide-react";

import {
  SabsmsDetailDrawer,
  SabsmsFilterBar,
  SabsmsRefreshButton,
} from "@/components/sabsms/page-toolkit";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  useToast,
} from "@/components/sabcrm/20ui";

import { SUBSCRIBABLE_EVENTS } from "@/lib/sabsms/webhooks-out/events";

import {
  deleteWebhook,
  rotateSecret,
  saveWebhook,
  testFireEndpoint,
  toggleWebhook,
} from "./actions";
import { DeliveriesPanel } from "./deliveries-panel";
import type { WebhookRow } from "./projection";

interface WebhooksTableProps {
  workspaceId: string;
  initialRows: WebhookRow[];
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

const EVENT_OPTIONS = SUBSCRIBABLE_EVENTS.map((e) => ({ value: e, label: e }));

function SecretOncePanel({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="space-y-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
      <p className="text-sm font-semibold text-[var(--st-text)]">Signing secret — shown once</p>
      <div className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2">
        <code className="break-all font-mono text-xs text-[var(--st-text)]">{secret}</code>
        <IconButton
          size="sm"
          label={copied ? "Copied" : "Copy secret"}
          icon={copied ? Check : Copy}
          onClick={() => {
            navigator.clipboard.writeText(secret);
            setCopied(true);
            toast.success("Secret copied");
            setTimeout(() => setCopied(false), 2000);
          }}
        />
      </div>
      <p className="text-[11px] text-[var(--st-text-secondary)]">
        Verify every delivery: hex HMAC-SHA256 of the raw request body with this secret must equal the
        <code className="mx-1">X-Sabsms-Signature</code> header.
      </p>
      <Button variant="primary" size="sm" onClick={onDismiss}>
        Done — secret stored
      </Button>
    </div>
  );
}

export function WebhooksTable({ workspaceId, initialRows }: WebhooksTableProps) {
  void workspaceId;
  const router = useRouter();
  const { toast } = useToast();

  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<WebhookRow | null>(null);
  const [secretOnce, setSecretOnce] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [testFiringId, setTestFiringId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<{
    id?: string;
    url: string;
    urlAlias: string;
    events: string[];
  }>({ url: "", urlAlias: "", events: [] });

  const selectedRow = React.useMemo(
    () => initialRows.find((r) => r.id === detailId),
    [initialRows, detailId]
  );

  React.useEffect(() => {
    function handleHashChange() {
      if (window.location.hash === "#new-webhook") {
        setSecretOnce(null);
        setDetailId("new");
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  React.useEffect(() => {
    if (detailId === "new") {
      setFormData({ url: "", urlAlias: "", events: ["message.delivered", "message.failed"] });
    } else if (selectedRow) {
      setFormData({
        id: selectedRow.id,
        url: selectedRow.url,
        urlAlias: selectedRow.urlAlias || "",
        events: selectedRow.events || [],
      });
    }
  }, [detailId, selectedRow]);

  function notifyResult(
    res: { ok: true } | { ok: false; error: string },
    okMessage: string,
  ) {
    if (res.ok) {
      toast.success(okMessage);
      router.refresh();
    } else {
      toast({ title: "Action failed", description: res.error, tone: "danger" });
    }
  }

  async function handleToggle(row: WebhookRow) {
    const res = await toggleWebhook(row.id, !row.isActive);
    notifyResult(res, `Webhook ${row.isActive ? "disabled" : "enabled"}`);
  }

  async function handleRotate(row: WebhookRow) {
    const res = await rotateSecret(row.id);
    if (res.ok && res.secret) {
      setDetailId(row.id);
      setSecretOnce(res.secret);
      toast.success("Secret rotated — update your endpoint now");
      router.refresh();
    } else if (!res.ok) {
      toast({ title: "Rotation failed", description: res.error, tone: "danger" });
    }
  }

  async function handleTestFire(row: WebhookRow) {
    setTestFiringId(row.id);
    const res = await testFireEndpoint(row.id);
    setTestFiringId(null);
    notifyResult(res, "Ping delivered (2xx) — see the deliveries log below.");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await deleteWebhook(deleteTarget.id);
    setDeleteTarget(null);
    notifyResult(res, "Endpoint deleted");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await saveWebhook(formData);
      if (res.ok) {
        if (res.secret) {
          // Creation path — keep the drawer open to show the secret ONCE.
          setSecretOnce(res.secret);
          toast.success("Endpoint created");
        } else {
          toast.success("Endpoint updated");
          setDetailId(null);
        }
        router.refresh();
      } else {
        toast({ title: "Failed to save webhook", description: res.error, tone: "danger" });
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleEventToggle(event: string) {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  return (
    <div className="space-y-4">
      <SabsmsFilterBar
        searchPlaceholder="Search endpoints by URL or alias..."
        facets={[
          { key: "status", label: "Status", options: STATUS_OPTIONS, multi: true },
          { key: "event", label: "Events", options: EVENT_OPTIONS, multi: true },
        ]}
        trailing={<SabsmsRefreshButton onRefresh={() => router.refresh()} />}
      />

      <div className="grid grid-cols-1 gap-4">
        {initialRows.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhooks configured"
            description="Add an https endpoint to receive signed real-time events: delivery receipts, inbound messages, opt-outs and link clicks."
            action={
              <Button
                variant="primary"
                iconLeft={Webhook}
                onClick={() => {
                  setSecretOnce(null);
                  setDetailId("new");
                }}
              >
                Add webhook
              </Button>
            }
          />
        ) : (
          initialRows.map((row) => (
            <Card key={row.id} variant="elevated" padding="none" className="overflow-hidden">
              <CardBody className="flex flex-col gap-6 p-5 xl:flex-row xl:items-center">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge tone={row.isActive ? "success" : "neutral"} dot>
                      {row.isActive ? "Active" : "Disabled"}
                    </Badge>
                    <span className="truncate text-lg font-semibold text-[var(--st-text)]">
                      {row.url}
                    </span>
                    {row.urlAlias && (
                      <Badge tone="neutral" kind="outline">
                        {row.urlAlias}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--st-text-secondary)]">Events:</span>
                    {row.events.length === 0 ? (
                      <Badge tone="neutral" className="font-mono text-xs">all events</Badge>
                    ) : (
                      row.events.map((e) => (
                        <Badge key={e} tone="neutral" className="font-mono text-xs">
                          {e}
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="font-mono text-xs text-[var(--st-text-tertiary)]">
                    HMAC-SHA256 (X-Sabsms-Signature) · Updated {row.updatedAt ? fmtDate(row.updatedAt) : "—"}
                  </div>
                </div>

                <div className="flex shrink-0 flex-row items-center justify-center gap-2 xl:w-48 xl:flex-col xl:items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    block
                    iconLeft={Settings}
                    className="justify-start"
                    onClick={() => {
                      setSecretOnce(null);
                      setDetailId(row.id);
                    }}
                  >
                    Edit endpoint
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    block
                    iconLeft={Activity}
                    className="justify-start"
                    loading={testFiringId === row.id}
                    disabled={testFiringId === row.id}
                    onClick={() => handleTestFire(row)}
                  >
                    Test fire
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    block
                    iconLeft={KeyRound}
                    className="justify-start"
                    onClick={() => handleRotate(row)}
                  >
                    Rotate secret
                  </Button>
                  <Button
                    variant={row.isActive ? "secondary" : "primary"}
                    size="sm"
                    block
                    iconLeft={row.isActive ? PowerOff : Power}
                    className="justify-start"
                    onClick={() => handleToggle(row)}
                  >
                    {row.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    block
                    iconLeft={Trash2}
                    className="justify-start"
                    onClick={() => setDeleteTarget(row)}
                  >
                    Delete
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      {/* V2.13 — real delivery log with replay. */}
      <DeliveriesPanel />

      <SabsmsDetailDrawer
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setSecretOnce(null);
          }
        }}
        title={detailId === "new" ? "Add webhook" : "Webhook endpoint"}
        description={
          secretOnce
            ? "Copy the signing secret now — it is shown only once."
            : detailId === "new"
              ? "Endpoints must be https. Deliveries are signed with HMAC-SHA256."
              : "Update the endpoint URL, alias and event filter."
        }
      >
        {secretOnce ? (
          <div className="py-4">
            <SecretOncePanel
              secret={secretOnce}
              onDismiss={() => {
                setSecretOnce(null);
                setDetailId(null);
              }}
            />
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex h-full flex-col space-y-6">
            <div className="flex-1 space-y-4 overflow-y-auto pb-4">
              <Field label="Endpoint URL (https only)" required>
                <Input
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://api.example.com/webhooks/sabsms"
                  required
                />
              </Field>

              <Field label="Alias (e.g. Staging / Prod)">
                <Input
                  value={formData.urlAlias}
                  onChange={(e) => setFormData({ ...formData, urlAlias: e.target.value })}
                  placeholder="Production endpoint"
                />
              </Field>

              <Field
                label="Subscribed events"
                help="Leave everything unchecked to receive ALL events."
              >
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <Checkbox
                      key={opt.value}
                      checked={formData.events.includes(opt.value)}
                      onChange={() => handleEventToggle(opt.value)}
                      label={opt.label}
                    />
                  ))}
                </div>
              </Field>

              <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-xs text-[var(--st-text-secondary)]">
                Retries: failed deliveries back off 30s → 5m → 1h → 6h (5 attempts total), then go
                terminal. Use Replay in the deliveries log to re-send any delivery.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--st-border)] pt-4">
              <Button type="button" variant="outline" onClick={() => setDetailId(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>
                {isSaving ? "Saving…" : detailId === "new" ? "Create endpoint" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </SabsmsDetailDrawer>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this endpoint?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.url} stops receiving events immediately. Past deliveries stay in the
              log for 90 days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
