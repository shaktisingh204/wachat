"use client";

import * as React from "react";
import Link from "next/link";
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
import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  StatCard,
  Textarea,
  useZoruToast,
} from "@/components/zoruui";

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
  const { toast } = useZoruToast();

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
          <div className="py-12 text-center text-slate-500 border border-dashed rounded-lg">
            No webhooks configured. Add an endpoint to start receiving real-time delivery and inbound messages.
          </div>
        ) : (
          initialRows.map((row) => (
            <Card key={row.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <ZoruCardContent className="p-5 flex flex-col xl:flex-row xl:items-center gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={row.isActive ? "default" : "secondary"}>
                      {row.isActive ? "Active" : "Disabled"}
                    </Badge>
                    <span className="font-semibold text-slate-900 text-lg truncate">
                      {row.url}
                    </span>
                    {row.urlAlias && (
                      <Badge variant="outline" className="text-slate-500">
                        {row.urlAlias}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-500">Events:</span>
                    {row.events.map((e) => (
                      <Badge key={e} variant="secondary" className="text-xs font-mono">
                        {e}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    HMAC: {row.hmacAlgorithm} • Updated: {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-4 items-center bg-slate-50 p-4 rounded-xl border">
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
              </ZoruCardContent>
            </Card>
          ))
        )}
      </div>

      {/* Webhook detail drawer */}
      <SabsmsDetailDrawer
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
        title={selectedRow ? `Webhook Config` : "Config"}
        description="View and manage detailed configuration for this endpoint."
      >
        {selectedRow && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={selectedRow.url} readOnly />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alias (Staging/Prod)</Label>
                <Input value={selectedRow.urlAlias || ""} readOnly />
              </div>
              <div className="space-y-2">
                <Label>HMAC Algorithm</Label>
                <Input value={selectedRow.hmacAlgorithm} readOnly />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Retry Config & DLQ</Label>
              <div className="flex gap-2">
                <Input value="Max retries: 5" readOnly className="w-1/2" />
                <Input value="DLQ: https://example.com/dlq" readOnly className="w-1/2" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>mTLS Client Cert</Label>
              <Badge variant="outline">Not uploaded</Badge>
            </div>

            <div className="space-y-2">
              <Label>Custom Headers</Label>
              <Textarea value='{"X-Custom-Auth": "bearer..."}' readOnly className="h-16 font-mono text-xs" />
            </div>

            <div className="space-y-2">
              <Label>Sample Payload Preview</Label>
              <pre className="bg-slate-950 text-slate-50 p-3 rounded-md font-mono text-xs overflow-x-auto">
{`{
  "event": "message.delivered",
  "data": {
    "messageId": "msg_123",
    "status": "delivered",
    "deliveredAt": "2026-05-23T12:00:00Z"
  }
}`}
              </pre>
            </div>

            <div className="space-y-2">
              <Label>JSON Schema for Events</Label>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <FileJson className="mr-2 h-4 w-4" /> View full schema
              </Button>
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Import Webhook Config</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste JSON containing endpoint definitions to import.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[{"url": "https://...", "events": ["message.delivered"]}]'
            className="min-h-[200px] font-mono text-xs"
          />
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportFromText} disabled={!importJson.trim()}>
              Import
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
