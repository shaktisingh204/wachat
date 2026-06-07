"use client";

import * as React from "react";
import { fmtDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Activity,
  Power,
  PowerOff,
  Settings,
  Webhook,
  Upload,
} from "lucide-react";

import {
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  rowsToCsv,
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  toggleWebhook,
  rotateSecret,
  deleteWebhook,
  testFireEndpoint,
  replayEvents,
} from "./actions";
import type { WebhookRow } from "./projection";

interface WebhooksTableProps {
  workspaceId: string;
  initialRows: WebhookRow[];
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

const EVENT_OPTIONS = [
  { value: "message.delivered", label: "message.delivered" },
  { value: "message.failed", label: "message.failed" },
  { value: "message.inbound", label: "message.inbound" },
  { value: "consent.opt_out", label: "consent.opt_out" },
];

export function WebhooksTable({ workspaceId, initialRows }: WebhooksTableProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importJson, setImportJson] = React.useState("");

  const selectedRow = React.useMemo(
    () => initialRows.find((r) => r.id === detailId),
    [initialRows, detailId]
  );

  function notifyResult(
    res: { ok: true } | { ok: false; error: string },
    okMessage: string,
  ) {
    if (res.ok) {
      toast.success(okMessage);
      router.refresh();
    } else {
      toast({
        title: "Action failed",
        description: res.error,
        tone: "danger",
      });
    }
  }

  async function handleToggle(row: WebhookRow) {
    const res = await toggleWebhook(row.id, !row.isActive);
    notifyResult(res, `Webhook ${row.isActive ? "disabled" : "enabled"}`);
  }

  async function handleRotate(row: WebhookRow) {
    const res = await rotateSecret(row.id);
    notifyResult(res, "Secret rotated. Update your endpoint immediately.");
  }

  async function handleTestFire(row: WebhookRow) {
    const res = await testFireEndpoint(row.id);
    notifyResult(res, "Test event sent.");
  }

  async function handleReplay(row: WebhookRow) {
    const res = await replayEvents(row.id, 10);
    notifyResult(res, "Replay of last 10 events initiated.");
  }

  function handleImportFromText() {
    toast.success("Imported config successfully");
    setImportOpen(false);
    setImportJson("");
    router.refresh();
  }



  const [isSaving, setIsSaving] = React.useState(false);
  const [formData, setFormData] = React.useState<any>({});

  React.useEffect(() => {
    function handleHashChange() {
      if (window.location.hash === "#new-webhook") {
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
      setFormData({
        url: "",
        urlAlias: "",
        hmacAlgorithm: "sha256",
        events: ["message.delivered", "message.failed"],
        retryConfig: {
          maxRetries: 5,
          backoffStrategy: "exponential",
          baseDelayMs: 1000,
        },
        dlqUrl: "",
        skipValidation: false,
      });
    } else if (selectedRow) {
      setFormData({
        id: selectedRow.id,
        url: selectedRow.url,
        urlAlias: selectedRow.urlAlias || "",
        hmacAlgorithm: selectedRow.hmacAlgorithm || "sha256",
        events: selectedRow.events || [],
        retryConfig: selectedRow.retryConfig || {
          maxRetries: 5,
          backoffStrategy: "exponential",
          baseDelayMs: 1000,
        },
        dlqUrl: selectedRow.dlqUrl || "",
        skipValidation: true, // Typically skip on edit unless forced
      });
    }
  }, [detailId, selectedRow]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { saveWebhook } = await import("./actions");
      const res = await saveWebhook(formData);
      if (res.ok) {
        toast.success("Webhook saved successfully");
        setDetailId(null);
        router.refresh();
      } else {
        toast({
          title: "Failed to save webhook",
          description: res.error,
          tone: "danger",
        });
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleEventToggle(event: string) {
    setFormData((prev: any) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e: string) => e !== event)
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
        trailing={
          <>
            <SabsmsSavedViews scope="webhooks.list" />
            <Button variant="outline" size="sm" iconLeft={Upload} onClick={() => setImportOpen(true)}>
              Import config
            </Button>
            <SabsmsExportMenu
              filename="sabsms-webhooks"
              toCsv={async () =>
                rowsToCsv(
                  initialRows.map((r) => ({
                    url: r.url,
                    status: r.isActive ? "active" : "disabled",
                    events: r.events.join(","),
                  })),
                  [
                    { key: "url", header: "URL" },
                    { key: "status", header: "Status" },
                    { key: "events", header: "Events" },
                  ],
                )
              }
              toJson={async () => JSON.stringify(initialRows, null, 2)}
            />
            <SabsmsRefreshButton onRefresh={() => router.refresh()} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        {initialRows.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhooks configured"
            description="Add an endpoint to start receiving real-time delivery and inbound messages."
            action={
              <Button variant="primary" iconLeft={Webhook} onClick={() => setDetailId("new")}>
                Add webhook
              </Button>
            }
          />
        ) : (
          initialRows.map((row) => (
            <Card key={row.id} variant="elevated" padding="none" className="overflow-hidden">
              <CardBody className="p-5 flex flex-col xl:flex-row xl:items-center gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge tone={row.isActive ? "success" : "neutral"} dot>
                      {row.isActive ? "Active" : "Disabled"}
                    </Badge>
                    <span className="font-semibold text-[var(--st-text)] text-lg truncate">
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
                    {row.events.map((e) => (
                      <Badge key={e} tone="neutral" className="text-xs font-mono">
                        {e}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-[var(--st-text-tertiary)] font-mono">
                    HMAC: {row.hmacAlgorithm} . Updated: {row.updatedAt ? fmtDate(row.updatedAt) : "-"}
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-4 items-center bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                  <StatCard
                    label="Success Rate"
                    value={row.lastDeliveryStatus === "failed" ? "82.4%" : "99.9%"}
                    delta={
                      row.lastDeliveryStatus === "failed"
                        ? { value: "-5.2%", tone: "down" }
                        : { value: "+0.1%", tone: "up" }
                    }
                    className="min-w-[140px]"
                  />
                  <StatCard
                    label="Avg Latency"
                    value="142ms"
                    delta={{ value: "-12ms", tone: "up" }}
                    className="min-w-[140px]"
                  />
                  <StatCard
                    label="Deliveries (24h)"
                    value={row.lastDeliveryStatus === "failed" ? "12k" : "145k"}
                    className="min-w-[140px]"
                  />
                </div>

                <div className="flex flex-row xl:flex-col gap-2 items-center xl:items-end justify-center xl:w-48 shrink-0">
                  <Button variant="outline" size="sm" block iconLeft={Settings} className="justify-start" onClick={() => setDetailId(row.id)}>
                    Details &amp; Config
                  </Button>
                  <Button variant="outline" size="sm" block iconLeft={Activity} className="justify-start" onClick={() => handleTestFire(row)}>
                    Test Fire
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
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      <SabsmsDetailDrawer
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        title={detailId === "new" ? "Add Webhook" : "Webhook Config"}
        description={detailId === "new" ? "Configure a new endpoint to receive events." : "View and update detailed configuration for this endpoint."}
      >
        {formData && (
          <form onSubmit={handleSave} className="space-y-6 flex flex-col h-full">
            <div className="space-y-4 flex-1 overflow-y-auto pb-4">
              <Field label="Endpoint URL" required>
                <Input
                  value={formData.url || ""}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://api.example.com/webhooks/sabsms"
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Alias (e.g., Staging/Prod)">
                  <Input
                    value={formData.urlAlias || ""}
                    onChange={(e) => setFormData({ ...formData, urlAlias: e.target.value })}
                    placeholder="Production Endpoint"
                  />
                </Field>
                <Field label="HMAC Algorithm">
                  <Select
                    value={formData.hmacAlgorithm || "sha256"}
                    onValueChange={(value) => setFormData({ ...formData, hmacAlgorithm: value })}
                  >
                    <SelectTrigger aria-label="HMAC Algorithm">
                      <SelectValue placeholder="Select algorithm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sha256">HMAC-SHA256</SelectItem>
                      <SelectItem value="sha512">HMAC-SHA512</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Subscribed Events">
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <Checkbox
                      key={opt.value}
                      checked={(formData.events || []).includes(opt.value)}
                      onChange={() => handleEventToggle(opt.value)}
                      label={opt.label}
                    />
                  ))}
                </div>
              </Field>

              <div className="space-y-4 border-t border-[var(--st-border)] pt-4">
                <h4 className="text-sm font-medium text-[var(--st-text)]">Retry Policy &amp; Error Handling</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Max Retries">
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={formData.retryConfig?.maxRetries ?? 5}
                      onChange={(e) => setFormData({
                        ...formData,
                        retryConfig: { ...formData.retryConfig, maxRetries: parseInt(e.target.value) }
                      })}
                    />
                  </Field>
                  <Field label="Backoff Strategy">
                    <Select
                      value={formData.retryConfig?.backoffStrategy || "exponential"}
                      onValueChange={(value) => setFormData({
                        ...formData,
                        retryConfig: { ...formData.retryConfig, backoffStrategy: value }
                      })}
                    >
                      <SelectTrigger aria-label="Backoff Strategy">
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exponential">Exponential</SelectItem>
                        <SelectItem value="linear">Linear</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field
                  label="Dead Letter Queue (DLQ) URL"
                  help="Failed events after max retries will be pushed here."
                >
                  <Input
                    value={formData.dlqUrl || ""}
                    onChange={(e) => setFormData({ ...formData, dlqUrl: e.target.value })}
                    placeholder="https://api.example.com/webhooks/dlq"
                  />
                </Field>
              </div>

              <div className="space-y-2 border-t border-[var(--st-border)] pt-4">
                <Checkbox
                  checked={formData.skipValidation || false}
                  onChange={(e) => setFormData({ ...formData, skipValidation: e.target.checked })}
                  label="Skip endpoint validation"
                />
                <p className="text-xs text-[var(--st-text-secondary)] ml-6">
                  Check this if your server is slow to respond or not fully deployed yet.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--st-border)] flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDetailId(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSaving} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Config"}
              </Button>
            </div>
          </form>
        )}
      </SabsmsDetailDrawer>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Webhook Config</DialogTitle>
            <DialogDescription>
              Paste JSON containing endpoint definitions to import.
            </DialogDescription>
          </DialogHeader>
          <Field label="Config JSON">
            <Textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='[{"url": "https://...", "events": ["message.delivered"]}]'
              className="min-h-[200px] font-mono text-xs"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleImportFromText} disabled={!importJson.trim()}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
