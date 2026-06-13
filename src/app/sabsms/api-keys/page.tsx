"use client";

import * as React from "react";
import {
  Activity,
  BookOpen,
  Check,
  Clock,
  Copy,
  Key,
  Plus,
  Shield,
  XCircle,
} from "lucide-react";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import {
  SabsmsDataTable,
  type SabsmsColumn,
} from "@/components/sabsms/page-toolkit/sabsms-data-table";
import { SabsmsDetailDrawer } from "@/components/sabsms/page-toolkit/sabsms-detail-drawer";
import { SabsmsRefreshButton } from "@/components/sabsms/page-toolkit/sabsms-refresh-button";

import {
  Badge,
  Button,
  Checkbox,
  Card,
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
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";

import { SABSMS_API_SCOPES } from "@/lib/sabsms/apikeys/scopes";

import {
  createApiKeyAction,
  keyUsageAction,
  listApiKeysAction,
  revokeApiKeyAction,
  type SabsmsApiKeyRow,
} from "./actions";

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "messages:send": "Send messages + manage suppressions",
  "messages:read": "Read messages + suppression list",
  otp: "Send and verify one-time codes",
  "webhooks:manage": "Manage outbound webhook endpoints",
  "analytics:read": "Read analytics rollups",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  return (
    <IconButton
      size="sm"
      label={copied ? "Copied" : label}
      icon={copied ? Check : Copy}
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      }}
    />
  );
}

function UsageSparkline({ keyId }: { keyId: string }) {
  const [points, setPoints] = React.useState<Array<{ hour: string; count: number }> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    keyUsageAction(keyId).then((res) => {
      if (cancelled) return;
      if (res.success) setPoints(res.points);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [keyId]);

  if (error) return <p className="text-xs text-[var(--st-text-secondary)]">{error}</p>;
  if (!points) {
    return <div className="h-12 animate-pulse rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]" />;
  }
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((acc, p) => acc + p.count, 0);
  return (
    <div>
      <div
        className="flex h-12 items-end gap-px rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-1.5 pb-1 pt-2"
        role="img"
        aria-label={`${total} requests in the last 24 hours`}
      >
        {points.map((p) => (
          <div
            key={p.hour}
            className="flex-1 rounded-sm bg-[var(--st-accent)]"
            style={{ height: `${Math.max(4, Math.round((p.count / max) * 100))}%`, opacity: p.count === 0 ? 0.15 : 1 }}
            title={`${p.hour}:00 UTC — ${p.count} requests`}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-[var(--st-text-secondary)]">
        {total} requests · last 24h (hourly)
      </p>
    </div>
  );
}

interface CreateFormState {
  name: string;
  scopes: string[];
  rateLimitPerMin: string;
  ipAllowlist: string;
}

const EMPTY_FORM: CreateFormState = {
  name: "",
  scopes: ["messages:send", "messages:read"],
  rateLimitPerMin: "300",
  ipAllowlist: "",
};

export default function ApiKeysPage() {
  const { toast } = useToast();

  const [keys, setKeys] = React.useState<SabsmsApiKeyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<CreateFormState>(EMPTY_FORM);
  const [creating, setCreating] = React.useState(false);
  /** Set right after a successful mint — the ONE place the raw key exists. */
  const [mintedKey, setMintedKey] = React.useState<{ rawKey: string; name: string } | null>(null);

  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<SabsmsApiKeyRow | null>(null);
  const [revoking, setRevoking] = React.useState(false);

  const fetchKeys = React.useCallback(async () => {
    setLoading(true);
    const res = await listApiKeysAction();
    if (res.success) {
      setKeys(res.keys);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const detailKey = detailId ? keys.find((k) => k.id === detailId) : undefined;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await createApiKeyAction({
      name: form.name,
      scopes: form.scopes,
      rateLimitPerMin: Number(form.rateLimitPerMin) || undefined,
      ipAllowlist: form.ipAllowlist
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setCreating(false);
    if (!res.success) {
      toast({ title: "Could not create key", description: res.error, tone: "danger" });
      return;
    }
    setMintedKey({ rawKey: res.rawKey, name: form.name });
    setForm(EMPTY_FORM);
    fetchKeys();
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const res = await revokeApiKeyAction(revokeTarget.id);
    setRevoking(false);
    setRevokeTarget(null);
    if (res.success) {
      toast.success("API key revoked — requests with it now fail with 401");
      fetchKeys();
    } else {
      toast({ title: "Revoke failed", description: res.error, tone: "danger" });
    }
  }

  const columns: SabsmsColumn<SabsmsApiKeyRow>[] = [
    {
      id: "name",
      header: "Key",
      render: (row) => (
        <div>
          <div className="flex items-center gap-2 font-semibold text-[var(--st-text)]">
            <Key className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
            {row.name}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.scopes.map((s) => (
              <Badge key={s} variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "prefix",
      header: "Token",
      render: (row) => (
        <span className="font-mono text-xs text-[var(--st-text)]">{row.prefix}…</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={row.revokedAt ? "destructive" : "success"}>
          {row.revokedAt ? "Revoked" : "Active"}
        </Badge>
      ),
    },
    {
      id: "rateLimit",
      header: "Rate limit",
      render: (row) => (
        <span className="flex items-center gap-1.5 text-sm text-[var(--st-text)]">
          <Activity className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
          {row.rateLimitPerMin}/min
        </span>
      ),
    },
    {
      id: "lastUsed",
      header: "Last used",
      render: (row) => (
        <span className="flex items-center gap-1.5 text-sm text-[var(--st-text)]">
          <Clock className="h-3 w-3 text-[var(--st-text-secondary)]" aria-hidden="true" />
          {row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : "Never"}
        </span>
      ),
    },
    {
      id: "created",
      header: "Created",
      render: (row) => (
        <span className="text-sm text-[var(--st-text-secondary)]">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <SabsmsPageShell
      title="API Keys"
      eyebrow="Developer"
      description="Scoped, hashed keys for the SabSMS public API. Each key carries its own rate limit and optional IP allowlist."
      breadcrumbs={[{ label: "Developer" }, { label: "API Keys" }]}
      primaryAction={{
        label: "Create API key",
        onClick: () => {
          setMintedKey(null);
          setCreateOpen(true);
        },
      }}
      secondaryActions={[
        { label: "API docs", onSelectHref: "/sabsms/api-docs" },
        { label: "SDK reference", onSelectHref: "/sabsms/sdk-reference" },
      ]}
      helpTitle="About API keys"
      helpBody="Keys authenticate Authorization: Bearer requests against /api/v1/sms. The full key is shown once at creation — only its hash is stored. Scope keys narrowly and rotate by creating a replacement, then revoking the old one."
      toolbar={
        <div className="mb-4 flex items-center justify-end gap-2">
          <SabsmsRefreshButton onRefresh={fetchKeys} />
        </div>
      }
    >
      {loadError ? (
        <p className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
          {loadError}
        </p>
      ) : keys.length === 0 && !loading ? (
        <Card padding="none" className="p-8">
          <EmptyState
            icon={Key}
            title="No API keys yet"
            description="Create a key to call the SabSMS public API — send messages, verify OTPs, manage suppressions and read analytics."
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => {
                  setMintedKey(null);
                  setCreateOpen(true);
                }}
              >
                Create API key
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <SabsmsDataTable
            columns={columns}
            rows={keys}
            rowKey={(r) => r.id}
            onRowClick={(row) => setDetailId(row.id)}
            rowActions={[
              { label: "View details", onSelect: (r) => setDetailId(r.id) },
              {
                label: "Revoke key",
                onSelect: (r) => setRevokeTarget(r),
                destructive: true,
              },
            ]}
          />
        </Card>
      )}

      {/* Create drawer — shows the raw key ONCE after mint. */}
      <SabsmsDetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setMintedKey(null);
          }
        }}
        title={mintedKey ? "Key created" : "Create API key"}
        description={
          mintedKey
            ? "Copy the key now — it is shown only once and cannot be recovered."
            : "Scopes and per-key rate limit are enforced on every request."
        }
      >
        {mintedKey ? (
          <div className="space-y-4 py-4">
            <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--st-text)]">
                {mintedKey.name}
              </p>
              <div className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2">
                <code className="break-all font-mono text-xs text-[var(--st-text)]">
                  {mintedKey.rawKey}
                </code>
                <CopyButton value={mintedKey.rawKey} label="Copy API key" />
              </div>
              <p className="mt-2 text-[11px] text-[var(--st-text-secondary)]">
                Store it in a secret manager. Anyone with this key can act within its scopes.
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--st-text)]">Quickstart</p>
              <pre className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 font-mono text-[11px] leading-relaxed text-[var(--st-text-secondary)]">
{`curl -X POST "${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/sms/messages" \\
  -H "Authorization: Bearer ${mintedKey.rawKey.slice(0, 12)}…" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+14155550100", "body": "Hello from SabSMS"}'`}
              </pre>
            </div>
            <div className="flex justify-end border-t border-[var(--st-border)] pt-4">
              <Button
                variant="primary"
                onClick={() => {
                  setCreateOpen(false);
                  setMintedKey(null);
                }}
              >
                Done — I copied the key
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-5 py-4">
            <Field label="Key name" required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Production backend"
                required
              />
            </Field>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--st-text)]">
                <Shield className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                Scopes
              </h4>
              <div className="space-y-2">
                {SABSMS_API_SCOPES.map((scope) => (
                  <div key={scope} className="flex items-start gap-2">
                    <Checkbox
                      checked={form.scopes.includes(scope)}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          scopes: prev.scopes.includes(scope)
                            ? prev.scopes.filter((s) => s !== scope)
                            : [...prev.scopes, scope],
                        }))
                      }
                      label={scope}
                    />
                    <span className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                      {SCOPE_DESCRIPTIONS[scope]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Field
              label="Rate limit (requests/minute)"
              help="Enforced per key with a sliding window. Default 300."
            >
              <Input
                type="number"
                min={1}
                max={10000}
                value={form.rateLimitPerMin}
                onChange={(e) => setForm({ ...form, rateLimitPerMin: e.target.value })}
              />
            </Field>

            <Field
              label="IP allowlist (optional)"
              help="One IP per line. Prefix entries with a trailing * are allowed (e.g. 10.0.*). Empty = any IP."
            >
              <Textarea
                rows={3}
                value={form.ipAllowlist}
                onChange={(e) => setForm({ ...form, ipAllowlist: e.target.value })}
                placeholder="203.0.113.4"
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-[var(--st-border)] pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={creating}
                disabled={creating || form.scopes.length === 0 || !form.name.trim()}
              >
                {creating ? "Creating…" : "Create key"}
              </Button>
            </div>
          </form>
        )}
      </SabsmsDetailDrawer>

      {/* Detail drawer — usage sparkline + security settings. */}
      <SabsmsDetailDrawer
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        title={detailKey?.name ?? "API key"}
        description="Per-key usage and security settings."
      >
        {detailKey && (
          <div className="space-y-5 py-4">
            <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
              <code className="font-mono text-xs text-[var(--st-text)]">{detailKey.prefix}…</code>
              <Badge variant={detailKey.revokedAt ? "destructive" : "success"}>
                {detailKey.revokedAt ? "Revoked" : "Active"}
              </Badge>
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--st-text)]">
                <Activity className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                Usage (24h)
              </h4>
              <UsageSparkline keyId={detailKey.id} />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--st-text-secondary)]">Scopes</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {detailKey.scopes.map((s) => (
                    <Badge key={s} variant="outline" className="px-1.5 py-0 text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--st-text-secondary)]">Rate limit</span>
                <span className="text-[var(--st-text)]">{detailKey.rateLimitPerMin}/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--st-text-secondary)]">IP allowlist</span>
                <span className="max-w-[220px] truncate text-right font-mono text-xs text-[var(--st-text)]">
                  {detailKey.ipAllowlist.length > 0 ? detailKey.ipAllowlist.join(", ") : "Any IP"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--st-text-secondary)]">Last used</span>
                <span className="text-[var(--st-text)]">
                  {detailKey.lastUsedAt ? new Date(detailKey.lastUsedAt).toLocaleString() : "Never"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--st-text-secondary)]">Created</span>
                <span className="text-[var(--st-text)]">
                  {new Date(detailKey.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-4">
              <a
                href="/sabsms/api-docs"
                className="flex items-center gap-1.5 text-xs font-medium text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> API documentation
              </a>
              {!detailKey.revokedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={XCircle}
                  onClick={() => setRevokeTarget(detailKey)}
                >
                  Revoke key
                </Button>
              )}
            </div>
          </div>
        )}
      </SabsmsDetailDrawer>

      {/* Revoke confirmation. */}
      <Dialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke “{revokeTarget?.name}”?</DialogTitle>
            <DialogDescription>
              Every request using this key immediately starts failing with 401. This cannot be
              undone — create a new key first if something still depends on it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={revoking} disabled={revoking} onClick={handleRevoke}>
              {revoking ? "Revoking…" : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SabsmsPageShell>
  );
}
