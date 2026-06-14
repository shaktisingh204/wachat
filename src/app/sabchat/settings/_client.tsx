"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, KeyRound, Lock, Plus, ShieldCheck, Smile, Trash2, Users } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  deleteSla,
  deleteSurvey,
  saveSla,
  saveSurvey,
} from "@/app/actions/sabchat-support.actions";
import {
  createScimToken,
  deleteBusinessHours,
  deleteRetention,
  deleteSso,
  deleteTeam,
  revokeScimToken,
  saveBusinessHours,
  saveRetention,
  saveSso,
  saveTeam,
  sweepRetention,
} from "@/app/actions/sabchat-ops.actions";
import type { SabChatSla } from "@/lib/rust-client/sabchat-sla";
import type { SabChatSurvey, SabChatSurveyKind } from "@/lib/rust-client/sabchat-csat";
import type { SabChatBusinessHour } from "@/lib/rust-client/sabchat-business-hours";
import type { SabChatTeam } from "@/lib/rust-client/sabchat-teams";
import type { SabChatRetentionRule } from "@/lib/rust-client/sabchat-compliance";
import type {
  SabChatSsoConfig,
  SabChatScimToken,
  SabChatSsoProvider,
} from "@/lib/rust-client/sabchat-sso";

type Tab = "sla" | "csat" | "hours" | "teams" | "compliance" | "security";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SettingsClient({
  initialSlas,
  initialSurveys,
  initialBusinessHours,
  initialTeams,
  initialRetention,
  initialSso,
  initialScim,
}: {
  initialSlas: SabChatSla[];
  initialSurveys: SabChatSurvey[];
  initialBusinessHours: SabChatBusinessHour[];
  initialTeams: SabChatTeam[];
  initialRetention: SabChatRetentionRule[];
  initialSso: SabChatSsoConfig[];
  initialScim: SabChatScimToken[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("sla");

  const handle = async (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => {
    const res = await fn();
    if (res.ok) {
      if (msg) toast({ title: msg });
      router.refresh();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
    return res.ok;
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Settings</PageTitle>
          <PageDescription>SLA targets and satisfaction surveys.</PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-5 flex gap-1 border-b border-[var(--st-border)]">
        {[
          { id: "sla" as const, label: "SLA policies", icon: ShieldCheck },
          { id: "hours" as const, label: "Business hours", icon: Clock },
          { id: "teams" as const, label: "Teams", icon: Users },
          { id: "csat" as const, label: "CSAT surveys", icon: Smile },
          { id: "compliance" as const, label: "Compliance", icon: Lock },
          { id: "security" as const, label: "Security (SSO)", icon: KeyRound },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === t.id
                  ? "border-[var(--st-primary,var(--st-accent))] font-medium text-[var(--st-text)]"
                  : "border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "sla" ? (
          <SlaSection slas={initialSlas} onAction={handle} />
        ) : tab === "hours" ? (
          <BusinessHoursSection hours={initialBusinessHours} onAction={handle} />
        ) : tab === "teams" ? (
          <TeamsSection teams={initialTeams} onAction={handle} />
        ) : tab === "compliance" ? (
          <ComplianceSection rules={initialRetention} onAction={handle} />
        ) : tab === "security" ? (
          <SecuritySection sso={initialSso} scim={initialScim} onAction={handle} />
        ) : (
          <CsatSection surveys={initialSurveys} onAction={handle} />
        )}
      </div>
    </div>
  );
}

type Runner = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => Promise<boolean>;

/* ── Business hours ────────────────────────────────────────────────────── */

function BusinessHoursSection({
  hours,
  onAction,
}: {
  hours: SabChatBusinessHour[];
  onAction: Runner;
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [timezone, setTimezone] = React.useState(tz);
  const [rows, setRows] = React.useState(
    DAYS.map((_, i) => ({ on: i >= 1 && i <= 5, open: "09:00", close: "17:00" })),
  );
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-[var(--st-text-secondary)]">
          Office hours pause SLA clocks and drive the widget&apos;s away message.
        </p>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New schedule
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {hours.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No business-hours schedules yet.
          </p>
        ) : (
          hours.map((h) => (
            <div key={h._id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">{h.name}</p>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {h.timezone} · {h.windows?.length ?? 0} open windows
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteBusinessHours(h._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New business-hours schedule</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support hours" autoFocus />
            </Field>
            <Field label="Timezone">
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </Field>
          </div>
          <div className="mt-1 space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <label className="flex w-16 items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={r.on}
                    onChange={(e) =>
                      setRows((p) => p.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))
                    }
                  />
                  {DAYS[i]}
                </label>
                <input
                  type="time"
                  value={r.open}
                  disabled={!r.on}
                  onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))}
                  className="rounded-md border border-[var(--st-border)] bg-transparent px-2 py-1 text-[var(--st-text)] disabled:opacity-40"
                />
                <span className="text-[var(--st-text-secondary)]">to</span>
                <input
                  type="time"
                  value={r.close}
                  disabled={!r.on}
                  onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))}
                  className="rounded-md border border-[var(--st-border)] bg-transparent px-2 py-1 text-[var(--st-text)] disabled:opacity-40"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                const windows = rows
                  .map((r, day) => ({ day, open: r.open, close: r.close, on: r.on }))
                  .filter((r) => r.on)
                  .map(({ day, open: o, close: c }) => ({ day, open: o, close: c }));
                const ok = await onAction(
                  () => saveBusinessHours({ name, timezone, windows }),
                  "Saved",
                );
                setBusy(false);
                if (ok) {
                  setName("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Teams ─────────────────────────────────────────────────────────────── */

function TeamsSection({ teams, onAction }: { teams: SabChatTeam[]; onAction: Runner }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-[var(--st-text-secondary)]">
          Group agents into teams to route conversations and report by team.
        </p>
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New team
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {teams.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">No teams yet.</p>
        ) : (
          teams.map((t) => (
            <div key={t._id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">{t.name}</p>
                {t.description ? (
                  <p className="truncate text-xs text-[var(--st-text-secondary)]">{t.description}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteTeam(t._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tier 2" autoFocus />
          </Field>
          <Field label="Description (optional)">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(() => saveTeam({ name, description }), "Created");
                setBusy(false);
                if (ok) {
                  setName("");
                  setDescription("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Compliance (data retention) ───────────────────────────────────────── */

const RETENTION_TARGETS = [
  { value: "conversations", label: "Conversations" },
  { value: "messages", label: "Messages" },
  { value: "audit_log", label: "Audit log" },
];

function ComplianceSection({
  rules,
  onAction,
}: {
  rules: SabChatRetentionRule[];
  onAction: Runner;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [target, setTarget] = React.useState("conversations");
  const [days, setDays] = React.useState("365");
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-[var(--st-text-secondary)]">
          Auto-delete data older than a threshold (GDPR/DPDP/CCPA).
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onAction(() => sweepRetention(), "Sweep started")}
          >
            Run sweep
          </Button>
          <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
            New rule
          </Button>
        </div>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {rules.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
            No retention rules yet.
          </p>
        ) : (
          rules.map((r) => (
            <div key={r._id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">{r.name}</p>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  {r.target} · older than {r.olderThanDays} days
                </p>
              </div>
              <Badge variant={r.active ? "default" : "outline"}>
                {r.active ? "Active" : "Paused"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteRetention(r._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New retention rule</DialogTitle>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Purge old chats" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target">
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-md border border-[var(--st-border)] bg-transparent px-2 py-2 text-sm text-[var(--st-text)]"
              >
                {RETENTION_TARGETS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Older than (days)">
              <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(
                  () => saveRetention({ name, target, olderThanDays: Number(days) || 0 }),
                  "Created",
                );
                setBusy(false);
                if (ok) {
                  setName("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Security (SSO + SCIM) ──────────────────────────────────────────────── */

function SecuritySection({
  sso,
  scim,
  onAction,
}: {
  sso: SabChatSsoConfig[];
  scim: SabChatScimToken[];
  onAction: Runner;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [provider, setProvider] = React.useState<SabChatSsoProvider>("saml");
  const [domain, setDomain] = React.useState("");
  const [metadataUrl, setMetadataUrl] = React.useState("");
  const [issuer, setIssuer] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [scimLabel, setScimLabel] = React.useState("");
  const [newToken, setNewToken] = React.useState<string | null>(null);

  const createScim = async () => {
    if (!scimLabel.trim()) return;
    const res = await createScimToken(scimLabel);
    if (res.ok) {
      setNewToken(res.token ?? null);
      setScimLabel("");
      toast({ title: "SCIM token created" });
      router.refresh();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      {/* SSO */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-[var(--st-text-secondary)]">
            Single sign-on (SAML / OIDC) for your team. Domain-matched.
          </p>
          <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
            New SSO connection
          </Button>
        </div>
        <Card className="divide-y divide-[var(--st-border)] p-0">
          {sso.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">
              No SSO connections yet.
            </p>
          ) : (
            sso.map((s) => (
              <div key={s._id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium uppercase text-[var(--st-text)]">{s.provider}</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">{s.domain ?? "any domain"}</p>
                </div>
                <Badge variant={s.enabled ? "default" : "outline"}>
                  {s.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Trash2}
                  onClick={() => void onAction(() => deleteSso(s._id), "Deleted")}
                />
              </div>
            ))
          )}
        </Card>
      </div>

      {/* SCIM */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-[var(--st-text)]">SCIM provisioning</h3>
        <p className="mb-2 text-xs text-[var(--st-text-secondary)]">
          Issue a bearer token for your IdP to auto-provision/deprovision agents.
        </p>
        {newToken ? (
          <div className="mb-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900">
            Copy this token now — it won&apos;t be shown again:
            <code className="mt-1 block break-all font-mono">{newToken}</code>
          </div>
        ) : null}
        <div className="mb-3 flex gap-2">
          <Input
            value={scimLabel}
            onChange={(e) => setScimLabel(e.target.value)}
            placeholder="Token label (e.g. Okta)"
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" disabled={!scimLabel.trim()} onClick={() => void createScim()}>
            Generate token
          </Button>
        </div>
        <Card className="divide-y divide-[var(--st-border)] p-0">
          {scim.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">No SCIM tokens.</p>
          ) : (
            scim.map((t) => (
              <div key={t._id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium text-[var(--st-text)]">{t.label}</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    {t.tokenLast4 ? `••••${t.tokenLast4}` : "active"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Trash2}
                  onClick={() => void onAction(() => revokeScimToken(t._id), "Revoked")}
                />
              </div>
            ))
          )}
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New SSO connection</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Protocol">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as SabChatSsoProvider)}
                className="w-full rounded-md border border-[var(--st-border)] bg-transparent px-2 py-2 text-sm uppercase text-[var(--st-text)]"
              >
                <option value="saml">SAML</option>
                <option value="oidc">OIDC</option>
              </select>
            </Field>
            <Field label="Email domain">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
            </Field>
          </div>
          {provider === "saml" ? (
            <Field label="Metadata URL">
              <Input value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} placeholder="https://idp/metadata" />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issuer">
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} />
              </Field>
              <Field label="Client ID">
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(
                  () =>
                    saveSso({
                      provider,
                      domain,
                      metadataUrl: provider === "saml" ? metadataUrl : undefined,
                      issuer: provider === "oidc" ? issuer : undefined,
                      clientId: provider === "oidc" ? clientId : undefined,
                    }),
                  "Saved",
                );
                setBusy(false);
                if (ok) setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SlaSection({ slas, onAction }: { slas: SabChatSla[]; onAction: Runner }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [frt, setFrt] = React.useState("");
  const [res, setRes] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New SLA
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {slas.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">No SLA policies yet.</p>
        ) : (
          slas.map((s) => (
            <div key={s._id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">{s.name}</p>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  First response {s.firstResponseMinutes ?? "—"}m · Resolution{" "}
                  {s.resolutionMinutes ?? "—"}m
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteSla(s._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New SLA policy</DialogTitle>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First response (min)">
              <Input type="number" value={frt} onChange={(e) => setFrt(e.target.value)} />
            </Field>
            <Field label="Resolution (min)">
              <Input type="number" value={res} onChange={(e) => setRes(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(
                  () =>
                    saveSla({
                      name,
                      firstResponseMinutes: frt ? Number(frt) : undefined,
                      resolutionMinutes: res ? Number(res) : undefined,
                    }),
                  "Created",
                );
                setBusy(false);
                if (ok) {
                  setName("");
                  setFrt("");
                  setRes("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CsatSection({ surveys, onAction }: { surveys: SabChatSurvey[]; onAction: Runner }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<SabChatSurveyKind>("csat");
  const [question, setQuestion] = React.useState("How would you rate the support you received?");
  const [busy, setBusy] = React.useState(false);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setOpen(true)}>
          New survey
        </Button>
      </div>
      <Card className="divide-y divide-[var(--st-border)] p-0">
        {surveys.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--st-text-secondary)]">No surveys yet.</p>
        ) : (
          surveys.map((s) => (
            <div key={s._id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--st-text)]">{s.name}</p>
                <p className="truncate text-xs text-[var(--st-text-secondary)]">{s.question}</p>
              </div>
              <Badge variant="secondary" className="uppercase">
                {s.kind}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => void onAction(() => deleteSurvey(s._id), "Deleted")}
              />
            </div>
          ))
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New survey</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Type">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as SabChatSurveyKind)}
                className="w-full rounded-md border border-[var(--st-border)] bg-transparent px-2 py-2 text-sm uppercase text-[var(--st-text)]"
              >
                <option value="csat">CSAT</option>
                <option value="nps">NPS</option>
                <option value="ces">CES</option>
              </select>
            </Field>
          </div>
          <Field label="Question">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              disabled={busy || !name.trim() || !question.trim()}
              onClick={async () => {
                setBusy(true);
                const ok = await onAction(() => saveSurvey({ name, kind, question }), "Created");
                setBusy(false);
                if (ok) {
                  setName("");
                  setOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
