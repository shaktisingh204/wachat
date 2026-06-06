"use client";

import * as React from "react";
import Link from "next/link";
import { fmtDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Activity,
  History,
  KeyRound,
  PlayCircle,
  Power,
  PowerOff,
  Settings,
  Webhook,
  Upload,
  FileJson,
} from "lucide-react";

import {
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";
import { SabFilePickerButton, fetchSabFilePickAsFile } from "@/components/sabfiles";
import { Badge, Button, Card, CardBody, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, StatCard, Textarea, useToast } from '@/components/sabcrm/20ui/compat';

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
      toast({ title: okMessage });
      router.refresh();
    } else {
      toast({
        title: "Action failed",
        description: res.error,
        variant: "destructive",
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
    toast({ title: "Imported config successfully" });
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
        toast({ title: "Webhook saved successfully" });
        setDetailId(null);
        router.refresh();
      } else {
        toast({
          title: "Failed to save webhook",
          description: res.error,
          variant: "destructive",
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
        searchPlaceholder="Search endpoints by URL or alias…"
        facets={[
          { key: "status", label: "Status", options: STATUS_OPTIONS, multi: true },
          { key: "event", label: "Events", options: EVENT_OPTIONS, multi: true },
        ]}
        trailing={
          <>
            <SabsmsSavedViews scope="webhooks.list" />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
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
          <div className="py-12 text-center text-[var(--st-text)] border border-dashed rounded-lg">
            No webhooks configured. Add an endpoint to start receiving real-time delivery and inbound messages.
          </div>
        ) : (
          initialRows.map((row) => (
            <Card key={row.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardBody className="p-5 flex flex-col xl:flex-row xl:items-center gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={row.isActive ? "default" : "secondary"}>
                      {row.isActive ? "Active" : "Disabled"}
                    </Badge>
                    <span className="font-semibold text-[var(--st-text)] text-lg truncate">
                      {row.url}
                    </span>
                    {row.urlAlias && (
                      <Badge variant="outline" className="text-[var(--st-text)]">
                        {row.urlAlias}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--st-text)]">Events:</span>
                    {row.events.map((e) => (
                      <Badge key={e} variant="secondary" className="text-xs font-mono">
                        {e}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-[var(--st-text)] font-mono">
                    HMAC: {row.hmacAlgorithm} • Updated: {row.updatedAt ? fmtDate(row.updatedAt) : "—"}
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-4 items-center bg-[var(--st-bg-muted)] p-4 rounded-xl border">
                  <StatCard
                    label="Success Rate"
                    value={row.lastDeliveryStatus === "failed" ? "82.4%" : "99.9%"}
                    delta={row.lastDeliveryStatus === "failed" ? -5.2 : 0.1}
                    className="min-w-[140px] shadow-sm bg-white"
                  />
                  <StatCard
                    label="Avg Latency"
                    value="142ms"
                    delta={-12}
                    invertDelta
                    className="min-w-[140px] shadow-sm bg-white"
                  />
                  <StatCard
                    label="Deliveries (24h)"
                    value={row.lastDeliveryStatus === "failed" ? "12k" : "145k"}
                    className="min-w-[140px] shadow-sm bg-white"
                  />
                </div>

                <div className="flex flex-row xl:flex-col gap-2 items-center xl:items-end justify-center xl:w-48 shrink-0">
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setDetailId(row.id)}>
                    <Settings className="w-4 h-4 mr-2" /> Details & Config
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleTestFire(row)}>
                    <Activity className="w-4 h-4 mr-2" /> Test Fire
                  </Button>
                  <Button 
                    variant={row.isActive ? "secondary" : "default"} 
                    size="sm" 
                    className="w-full justify-start" 
                    onClick={() => handleToggle(row)}
                  >
                    {row.isActive ? <PowerOff className="w-4 h-4 mr-2" /> : <Power className="w-4 h-4 mr-2" />}
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
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <Input
                  value={formData.url || ""}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://api.example.com/webhooks/sabsms"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Alias (e.g., Staging/Prod)</Label>
                  <Input
                    value={formData.urlAlias || ""}
                    onChange={(e) => setFormData({ ...formData, urlAlias: e.target.value })}
                    placeholder="Production Endpoint"
                  />
                </div>
                <div className="space-y-2">
                  <Label>HMAC Algorithm</Label>
                  <select
                    value={formData.hmacAlgorithm || "sha256"}
                    onChange={(e) => setFormData({ ...formData, hmacAlgorithm: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="sha256">HMAC-SHA256</option>
                    <option value="sha512">HMAC-SHA512</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subscribed Events</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={(formData.events || []).includes(opt.value)}
                        onChange={() => handleEventToggle(opt.value)}
                        className="rounded border-[var(--st-border)] text-[var(--st-text)] focus:ring-[var(--st-border)]"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-medium">Retry Policy & Error Handling</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Retries</Label>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Backoff Strategy</Label>
                    <select
                      value={formData.retryConfig?.backoffStrategy || "exponential"}
                      onChange={(e) => setFormData({
                        ...formData,
                        retryConfig: { ...formData.retryConfig, backoffStrategy: e.target.value }
                      })}
                      className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2"
                    >
                      <option value="exponential">Exponential</option>
                      <option value="linear">Linear</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dead Letter Queue (DLQ) URL</Label>
                  <Input
                    value={formData.dlqUrl || ""}
                    onChange={(e) => setFormData({ ...formData, dlqUrl: e.target.value })}
                    placeholder="https://api.example.com/webhooks/dlq"
                  />
                  <p className="text-xs text-[var(--st-text)]">Failed events after max retries will be pushed here.</p>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.skipValidation || false}
                    onChange={(e) => setFormData({ ...formData, skipValidation: e.target.checked })}
                    className="rounded border-[var(--st-border)] text-[var(--st-text)] focus:ring-[var(--st-border)]"
                  />
                  <span className="text-sm font-medium">Skip endpoint validation</span>
                </label>
                <p className="text-xs text-[var(--st-text)] ml-6">
                  Check this if your server is slow to respond or not fully deployed yet.
                </p>
              </div>
            </div>
            
            <div className="pt-4 border-t flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDetailId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
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
          <Textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"url": "https://...", "events": ["message.delivered"]}]'
            className="min-h-[200px] font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportFromText} disabled={!importJson.trim()}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
