"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ServerCog, RefreshCw, Globe, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { SabsmsDataTable, SabsmsColumn } from "@/components/sabsms/page-toolkit/sabsms-data-table";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/sabcrm/20ui";
import {
  pingProvidersAction,
  saveProviderAccountAction,
  deleteProviderAccountAction,
  setDefaultProviderAccountAction,
  testProviderConnectionAction,
} from "./actions";

export interface ProviderRow {
  id: string;
  provider: string;
  region?: string;
  isDefault: boolean;
  status: string;
  lastError?: string;
  createdAt: string;
  webhookUrls: { inbound: string; dlr: string } | null;
}

export interface ProviderCatalogItem {
  id: string;
  name: string;
  available: boolean;
  region: string;
}

type StatusTone = "success" | "warning" | "danger" | "neutral";

function statusTone(status: string): StatusTone {
  if (status === "active") return "success";
  if (status === "disabled") return "warning";
  if (status === "error") return "danger";
  return "neutral";
}

interface CredentialField {
  key: string;
  label: string;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
}

const PROVIDER_FIELDS: Record<string, CredentialField[]> = {
  twilio: [
    { key: "accountSid", label: "Account SID", required: true, placeholder: "AC..." },
    { key: "authToken", label: "Auth token", required: true, secret: true },
  ],
  telnyx: [
    { key: "apiKey", label: "API key", required: true, secret: true, placeholder: "KEY..." },
    {
      key: "publicKey",
      label: "Ed25519 public key — for webhook signature verification (optional)",
    },
    { key: "messagingProfileId", label: "Messaging profile ID (optional)" },
  ],
  msg91: [
    { key: "authKey", label: "Auth key", required: true, secret: true },
    { key: "senderId", label: "Sender ID (optional)", placeholder: "e.g. SABSMS" },
    { key: "dltEntityId", label: "DLT entity ID (optional)" },
  ],
  gupshup: [
    { key: "userid", label: "User ID", required: true },
    { key: "password", label: "Password", required: true, secret: true },
  ],
};

const PROVIDER_NAMES: Record<string, string> = {
  twilio: "Twilio",
  telnyx: "Telnyx",
  msg91: "MSG91",
  gupshup: "Gupshup",
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} URL copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-[var(--st-text-secondary)]">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1.5 font-mono text-xs text-[var(--st-text)]">
          {value}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          aria-label={`Copy ${label} URL`}
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

export function ProvidersClient({
  initialRows,
  catalog,
}: {
  initialRows: ProviderRow[];
  catalog: ProviderCatalogItem[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ProviderRow[]>(initialRows);
  const [isPinging, setIsPinging] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Add-account dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formProvider, setFormProvider] = useState<string>("twilio");
  const [formCreds, setFormCreds] = useState<Record<string, string>>({});
  const [formRegion, setFormRegion] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedWebhookUrls, setSavedWebhookUrls] = useState<{ inbound: string; dlr: string } | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<ProviderRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableProviders = catalog.filter((c) => c.available);

  const openAddDialog = (provider?: string) => {
    setFormProvider(provider && PROVIDER_FIELDS[provider] ? provider : "twilio");
    setFormCreds({});
    setFormRegion("");
    setFormIsDefault(false);
    setSavedWebhookUrls(null);
    setAddDialogOpen(true);
  };

  const handleRefreshStatuses = async () => {
    setIsPinging(true);
    try {
      const res = await pingProvidersAction();
      if (res.success && res.rows) {
        setRows(res.rows);
        toast.success("Provider statuses refreshed");
      } else if (!res.success) {
        toast.error(res.error ?? "Refresh failed");
      }
    } catch {
      toast.error("Refresh failed");
    } finally {
      setIsPinging(false);
    }
  };

  const handleTestConnection = async (row: ProviderRow) => {
    setTestingId(row.id);
    try {
      const res = await testProviderConnectionAction(row.id);
      if (res.ok) {
        toast.success(`${PROVIDER_NAMES[row.provider] ?? row.provider}: connection OK${res.detail ? ` — ${res.detail}` : ""}`);
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "active", lastError: undefined } : r)),
        );
      } else {
        toast.error(`${PROVIDER_NAMES[row.provider] ?? row.provider}: ${res.error ?? "connection test failed"}`);
        if (res.error !== "engine unreachable") {
          setRows((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, status: "error", lastError: res.error } : r)),
          );
        }
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (row: ProviderRow) => {
    const res = await setDefaultProviderAccountAction(row.id);
    if (res.success) {
      toast.success(`${PROVIDER_NAMES[row.provider] ?? row.provider} set as default`);
      setRows((prev) =>
        prev.map((r) =>
          r.provider === row.provider ? { ...r, isDefault: r.id === row.id } : r,
        ),
      );
    } else {
      toast.error(res.error ?? "Failed to set default");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteProviderAccountAction(deleteTarget.id);
      if (res.success) {
        toast.success("Provider account deleted");
        setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        toast.error(res.error ?? "Delete failed");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    const fields = PROVIDER_FIELDS[formProvider] ?? [];
    const missing = fields.filter((f) => f.required && !(formCreds[f.key] ?? "").trim());
    if (missing.length > 0) {
      toast.error(`Missing: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    // Strip optional fields the user left empty (the action rejects empty values).
    const credentials = Object.fromEntries(
      fields
        .map((f) => [f.key, (formCreds[f.key] ?? "").trim()] as const)
        .filter(([, v]) => v.length > 0),
    );

    setIsSaving(true);
    try {
      const res = await saveProviderAccountAction({
        provider: formProvider,
        credentials,
        region: formRegion.trim() || undefined,
        isDefault: formIsDefault,
      });
      if (res.success) {
        toast.success("Provider account saved");
        setSavedWebhookUrls(res.webhookUrls ?? null);
        router.refresh();
        // Refresh the table rows from the server list.
        const ping = await pingProvidersAction();
        if (ping.success && ping.rows) setRows(ping.rows);
      } else {
        toast.error(res.error ?? "Save failed");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const columns: SabsmsColumn<ProviderRow>[] = [
    {
      id: "provider",
      header: "Provider",
      render: (r) => (
        <div className="font-medium flex items-center gap-2 capitalize">
          {PROVIDER_NAMES[r.provider] ?? r.provider}
          {r.isDefault && <Badge tone="accent">Default</Badge>}
        </div>
      ),
    },
    {
      id: "region",
      header: "Region",
      render: (r) => r.region || "—",
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(r.status)}>
            {testingId === r.id ? "Testing..." : r.status}
          </Badge>
          {r.lastError && (
            <span className="max-w-[240px] truncate text-xs text-[var(--st-danger)]" title={r.lastError}>
              {r.lastError}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "created",
      header: "Created",
      render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"),
    },
  ];

  const rowActions = [
    {
      label: "Test connection",
      onSelect: (r: ProviderRow) => handleTestConnection(r),
    },
    {
      label: "Set as default",
      onSelect: (r: ProviderRow) => handleSetDefault(r),
    },
    {
      label: "View details",
      onSelect: (r: ProviderRow) => router.push(`/sabsms/providers/${r.id}`),
    },
    {
      label: "Delete",
      destructive: true,
      onSelect: (r: ProviderRow) => setDeleteTarget(r),
    },
  ];

  const formFields = PROVIDER_FIELDS[formProvider] ?? [];

  return (
    <SabsmsPageShell
      title="Providers"
      eyebrow="Infrastructure"
      description="Connected SMS gateways for outbound routing."
      breadcrumbs={[{ label: "Providers" }]}
      primaryAction={{
        label: "Add Provider",
        onClick: () => openAddDialog(),
      }}
      secondaryActions={[
        {
          label: "Refresh statuses",
          icon: (
            <RefreshCw
              className={`h-4 w-4 ${isPinging ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          ),
          onSelectAction: handleRefreshStatuses,
        },
        { label: "Audit log", onSelectHref: "/sabsms/logs?type=audit" },
      ]}
      helpTitle="Provider accounts"
      helpBody="Connect Twilio, Telnyx, MSG91 or Gupshup credentials. Credentials are encrypted per workspace; the engine routes sends through the default account per provider."
    >
      <Card padding="none" className="p-4 flex flex-col gap-4 mb-6">
        <CardHeader className="px-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-semibold">Configured Accounts</CardTitle>
              <CardDescription>Connected SMS gateway accounts for this workspace.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshStatuses}
              disabled={isPinging}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isPinging ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {isPinging ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <div>
          <SabsmsDataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            rowActions={rowActions}
            onRowClick={(r) => router.push(`/sabsms/providers/${r.id}`)}
            emptyIcon={<ServerCog className="h-10 w-10 text-[var(--st-text-secondary)]" aria-hidden="true" />}
            emptyTitle="No providers configured"
            emptyDescription="Add a provider account to start sending messages."
            emptyAction={{ label: "Add Provider", onClick: () => openAddDialog() }}
          />
        </div>
      </Card>

      <Card padding="none" className="p-4 flex flex-col gap-4">
        <CardHeader className="px-2 mb-2">
          <CardTitle className="text-lg font-semibold">Provider Catalog</CardTitle>
          <CardDescription>Supported SMS gateways. Twilio, Telnyx, MSG91 and Gupshup are available today.</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
          {catalog.map((p) => (
            <Card key={p.id} variant="interactive" padding="none" className="p-4 flex flex-col justify-between">
              <CardBody className="p-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-[var(--st-text)]">{p.name}</div>
                  <Badge tone={p.available ? "success" : "neutral"}>
                    {p.available ? "Available" : "Coming Soon"}
                  </Badge>
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] mb-6 flex items-center gap-1">
                  <Globe className="h-3 w-3" aria-hidden="true" /> {p.region}
                </div>
              </CardBody>
              <CardFooter className="p-0">
                <Button
                  variant={p.available ? "primary" : "outline"}
                  disabled={!p.available}
                  size="sm"
                  block
                  onClick={() => openAddDialog(p.id)}
                >
                  {p.available ? "Configure" : "Coming Soon"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </Card>

      {/* Add-account dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setSavedWebhookUrls(null);
        }}
      >
        <DialogContent className="max-w-lg">
          {savedWebhookUrls ? (
            <>
              <DialogHeader>
                <DialogTitle>Webhook URLs</DialogTitle>
                <DialogDescription>
                  Paste these URLs into your {PROVIDER_NAMES[formProvider] ?? formProvider} dashboard
                  so inbound messages and delivery receipts reach SabSMS.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <CopyField label="Inbound" value={savedWebhookUrls.inbound} />
                <CopyField label="Delivery reports (DLR)" value={savedWebhookUrls.dlr} />
                <p className="text-xs text-[var(--st-text-secondary)]">
                  These URLs contain a secret used to authenticate webhooks — keep them private.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setAddDialogOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add provider account</DialogTitle>
                <DialogDescription>
                  Credentials are encrypted with a workspace-bound key before storage.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={formProvider} onValueChange={(v) => { setFormProvider(v); setFormCreds({}); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProviders.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formFields.map((f) => (
                  <div key={f.key} className="space-y-2">
                    <Label htmlFor={`cred-${f.key}`}>{f.label}</Label>
                    <Input
                      id={`cred-${f.key}`}
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      placeholder={f.placeholder}
                      value={formCreds[f.key] ?? ""}
                      onChange={(e) =>
                        setFormCreds((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label htmlFor="provider-region">Region (optional)</Label>
                  <Input
                    id="provider-region"
                    placeholder="e.g. us1, eu, in"
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="provider-default"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                  />
                  <Label htmlFor="provider-default">Set as default for this provider</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save account"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete provider account</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Remove the ${PROVIDER_NAMES[deleteTarget.provider] ?? deleteTarget.provider} account? Sends routed through it will stop immediately.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
