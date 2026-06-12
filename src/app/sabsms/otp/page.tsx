"use client";

/**
 * /sabsms/otp — OTP / Verify dashboard (V2.7).
 *
 * Three surfaces over the engine-native OTP stack:
 *   - Config: the workspace's `sabsms_otp_configs` knobs (code length,
 *     TTL, budgets, template) + a live test console that exercises the
 *     REAL `/v1/otp/send|verify|resend` endpoints (fraud guard and rate
 *     limits included) and `/v1/lookup`;
 *   - Conversion analytics: per-(country, prefix) sent/converted/rate
 *     from `GET /v1/otp/stats` — the same Redis window the router ranks
 *     OTP-category routes by;
 *   - Fraud guard: mode indicator, `sabsms_fraud_blocks` rows (manual
 *     add/remove for workspace rows; platform auto-blocks read-only),
 *     and the recent fraud events from `sabsms_event_log`.
 */

import * as React from "react";
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  KeySquare,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";

import { SabsmsPageShell, SabsmsRefreshButton } from "@/components/sabsms/page-toolkit";
import {
  SabsmsEmpty,
  SabsmsErrorState,
  SabsmsTableSkeleton,
} from "@/components/sabsms/page-toolkit/sabsms-states";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";

import type {
  SabsmsLookupResult,
  SabsmsOtpSendResult,
  SabsmsOtpStats,
} from "@/lib/sabsms/engine-client";
import {
  formatConversionRate,
  previewOtpTemplate,
  SABSMS_OTP_CONFIG_DEFAULTS,
  type SabsmsOtpConfig,
} from "@/lib/sabsms/otp";

import {
  addFraudBlockAction,
  getOtpConfigAction,
  getOtpStatsAction,
  listFraudBlocksAction,
  listFraudEventsAction,
  lookupNumberAction,
  removeFraudBlockAction,
  saveOtpConfigAction,
  testOtpResendAction,
  testOtpSendAction,
  testOtpVerifyAction,
  type SabsmsFraudBlockRow,
  type SabsmsFraudEventRow,
} from "./actions";

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function FraudModeBadge({ mode }: { mode: SabsmsOtpStats["fraudMode"] | null }) {
  if (mode === "enforce") {
    return (
      <Badge tone="success" kind="outline">
        <ShieldCheck className="h-3 w-3 mr-1" aria-hidden="true" />
        enforce
      </Badge>
    );
  }
  if (mode === "monitor") {
    return (
      <Badge tone="warning" kind="outline">
        <ShieldAlert className="h-3 w-3 mr-1" aria-hidden="true" />
        monitor
      </Badge>
    );
  }
  if (mode === "off") {
    return (
      <Badge tone="danger" kind="outline">
        <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />
        off
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" kind="outline">
      —
    </Badge>
  );
}

function ResultLine({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "err";
  children: React.ReactNode;
}) {
  const color =
    tone === "ok"
      ? "text-[var(--st-status-ok)]"
      : tone === "warn"
        ? "text-[var(--st-warn)]"
        : "text-[var(--st-danger)]";
  return <p className={`text-xs ${color}`}>{children}</p>;
}

// ---------------------------------------------------------------------------
// Config card (form + test console)
// ---------------------------------------------------------------------------

function ConfigCard() {
  const [config, setConfig] = React.useState<SabsmsOtpConfig>({
    ...SABSMS_OTP_CONFIG_DEFAULTS,
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);

  React.useEffect(() => {
    void (async () => {
      const res = await getOtpConfigAction();
      if (res.success) setConfig(res.config);
      else setNote({ tone: "err", text: res.error });
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof SabsmsOtpConfig>(key: K, value: SabsmsOtpConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const save = async () => {
    setSaving(true);
    setNote(null);
    const res = await saveOtpConfigAction(config);
    if (res.success) {
      setConfig(res.config);
      setNote({ tone: "ok", text: "Saved — applies to the next send." });
    } else {
      setNote({ tone: "err", text: res.error });
    }
    setSaving(false);
  };

  // Sample code matching the configured length, for the live preview.
  const sampleCode = "48291573".slice(0, Math.min(8, Math.max(4, config.codeLength)));
  const preview = previewOtpTemplate(config.templateBody, sampleCode, config.brandName);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeySquare className="h-4 w-4" aria-hidden="true" />
          OTP configuration
        </CardTitle>
        <CardDescription>
          Code shape, budgets and SMS template for this workspace. Values outside the engine
          ranges are clamped on save.
        </CardDescription>
      </CardHeader>
      <CardBody>
        {loading ? (
          <SabsmsTableSkeleton columns={3} rows={3} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Field label="Code length" help="4–8 digits">
                <Input
                  type="number"
                  min={4}
                  max={8}
                  value={String(config.codeLength)}
                  onChange={(e) => set("codeLength", Number(e.target.value))}
                />
              </Field>
              <Field label="TTL (seconds)" help="30–3600">
                <Input
                  type="number"
                  min={30}
                  max={3600}
                  value={String(config.ttlSecs)}
                  onChange={(e) => set("ttlSecs", Number(e.target.value))}
                />
              </Field>
              <Field label="Max attempts" help="1–20">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={String(config.maxAttempts)}
                  onChange={(e) => set("maxAttempts", Number(e.target.value))}
                />
              </Field>
              <Field label="Max resends" help="0–10">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={String(config.maxResends)}
                  onChange={(e) => set("maxResends", Number(e.target.value))}
                />
              </Field>
              <Field label="Resend cooldown (s)" help="5–600">
                <Input
                  type="number"
                  min={5}
                  max={600}
                  value={String(config.resendCooldownSecs)}
                  onChange={(e) => set("resendCooldownSecs", Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Field
                  label="SMS template"
                  help={
                    <>
                      <code>{"{#code#}"}</code> and <code>{"{#brand#}"}</code> are substituted.
                      Preview: <span className="italic">{preview}</span>
                    </>
                  }
                >
                  <Input
                    value={config.templateBody}
                    onChange={(e) => set("templateBody", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sender ID" help="Optional">
                  <Input
                    value={config.senderId ?? ""}
                    onChange={(e) => set("senderId", e.target.value || undefined)}
                  />
                </Field>
                <Field label="Brand name" help="Optional">
                  <Input
                    value={config.brandName ?? ""}
                    onChange={(e) => set("brandName", e.target.value || undefined)}
                  />
                </Field>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Save configuration"}
              </Button>
              {note ? <ResultLine tone={note.tone}>{note.text}</ResultLine> : null}
            </div>

            <TestConsole />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function TestConsole() {
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [sendInfo, setSendInfo] = React.useState<SabsmsOtpSendResult | null>(null);
  const [line, setLine] = React.useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(
    null,
  );
  const [lookup, setLookup] = React.useState<SabsmsLookupResult | null>(null);

  const run = async (
    label: string,
    fn: () => Promise<{ tone: "ok" | "warn" | "err"; text: string }>,
  ) => {
    setBusy(label);
    setLine(null);
    try {
      setLine(await fn());
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="border border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] p-4 space-y-3">
      <p className="text-sm font-medium">Test console</p>
      <p className="text-xs text-[var(--st-text-secondary)]">
        Live calls against the engine — fraud guard, rate limits and credits all apply.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Phone (E.164)">
          <Input
            placeholder="+14155552671"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-44"
          />
        </Field>
        <Button
          size="sm"
          disabled={busy != null || !phone.trim()}
          onClick={() =>
            void run("send", async () => {
              const res = await testOtpSendAction({ to: phone });
              if (!res.success) return { tone: "err", text: res.error };
              setSendInfo(res.result);
              const exp = new Date(res.result.expiresAt * 1000).toLocaleTimeString();
              return { tone: "ok", text: `Code sent — expires ${exp}` };
            })
          }
        >
          <Send className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          {busy === "send" ? "Sending…" : "Send code"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy != null || !phone.trim()}
          onClick={() =>
            void run("resend", async () => {
              const res = await testOtpResendAction({ to: phone });
              if (!res.success) return { tone: "warn", text: res.error };
              setSendInfo(res.result);
              return { tone: "ok", text: "Same code re-sent" };
            })
          }
        >
          {busy === "resend" ? "Resending…" : "Resend"}
        </Button>
        <Field label="Code">
          <Input
            placeholder="482915"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-28"
          />
        </Field>
        <Button
          size="sm"
          variant="outline"
          disabled={busy != null || !phone.trim() || !code.trim()}
          onClick={() =>
            void run("verify", async () => {
              const res = await testOtpVerifyAction({ to: phone, code });
              if (!res.success) return { tone: "err", text: res.error };
              return res.result.verified
                ? { tone: "ok", text: "Verified — conversion recorded" }
                : { tone: "warn", text: `Not verified (${res.result.reason ?? "unknown"})` };
            })
          }
        >
          <BadgeCheck className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          {busy === "verify" ? "Verifying…" : "Verify"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy != null || !phone.trim()}
          onClick={() =>
            void run("lookup", async () => {
              const res = await lookupNumberAction({ to: phone });
              if (!res.success) return { tone: "err", text: res.error };
              setLookup(res.result);
              return {
                tone: "ok",
                text: `${res.result.lineType ?? "unknown line type"} · ${res.result.carrierName ?? "unknown carrier"} (${res.result.source})`,
              };
            })
          }
        >
          <Search className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          {busy === "lookup" ? "Looking up…" : "Lookup"}
        </Button>
      </div>
      {line ? <ResultLine tone={line.tone}>{line.text}</ResultLine> : null}
      {sendInfo ? (
        <p className="text-xs text-[var(--st-text-secondary)]">
          otpId <code>{sendInfo.otpId}</code>
          {sendInfo.messageId ? (
            <>
              {" "}
              · message <code>{sendInfo.messageId}</code>
            </>
          ) : null}
        </p>
      ) : null}
      {lookup ? (
        <p className="text-xs text-[var(--st-text-secondary)]">
          Lookup: {lookup.lineType ?? "—"} · {lookup.carrierName ?? "—"} · MCC{" "}
          {lookup.mobileCountryCode ?? "—"} · via {lookup.source}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversion analytics card
// ---------------------------------------------------------------------------

function ConversionCard({
  stats,
  loading,
  error,
  onRetry,
}: {
  stats: SabsmsOtpStats | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4" aria-hidden="true" />
          Conversion analytics
        </CardTitle>
        <CardDescription>
          Sent vs verified per destination country and prefix over the last{" "}
          {stats ? Math.round(stats.windowSecs / 3600) : 2}h — the router ranks OTP routes by
          this conversion rate.
        </CardDescription>
      </CardHeader>
      <CardBody>
        {loading ? (
          <SabsmsTableSkeleton columns={5} rows={3} />
        ) : error ? (
          <SabsmsErrorState message={error} onRetry={onRetry} />
        ) : !stats || stats.rows.length === 0 ? (
          <SabsmsEmpty
            icon={<Activity />}
            title="No OTP traffic in the window"
            description="Send a code from the test console (or your API) and conversion rows appear here within seconds."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Country</Th>
                <Th>Prefix</Th>
                <Th>Sent</Th>
                <Th>Converted</Th>
                <Th>Rate</Th>
              </Tr>
            </THead>
            <TBody>
              {stats.rows.map((r) => (
                <Tr key={`${r.country}:${r.prefix}`}>
                  <Td className="font-medium">{r.country}</Td>
                  <Td>
                    <code>{r.prefix}</code>
                  </Td>
                  <Td>{r.sent.toLocaleString()}</Td>
                  <Td>{r.converted.toLocaleString()}</Td>
                  <Td>
                    <Badge
                      tone={r.rate >= 0.5 ? "success" : r.rate > 0 ? "warning" : "danger"}
                      kind="outline"
                    >
                      {formatConversionRate(r.sent, r.converted)}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fraud guard card
// ---------------------------------------------------------------------------

function FraudCard({ mode }: { mode: SabsmsOtpStats["fraudMode"] | null }) {
  const [blocks, setBlocks] = React.useState<SabsmsFraudBlockRow[]>([]);
  const [events, setEvents] = React.useState<SabsmsFraudEventRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [prefix, setPrefix] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [b, e] = await Promise.all([listFraudBlocksAction(), listFraudEventsAction(20)]);
    if (b.success) {
      setBlocks(b.blocks);
      setError(null);
    } else {
      setError(b.error);
    }
    if (e.success) setEvents(e.events);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    setBusy(true);
    setNote(null);
    const res = await addFraudBlockAction({ prefix });
    if (res.success) {
      setBlocks((b) => [res.block, ...b]);
      setPrefix("");
    } else {
      setNote(res.error);
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    setBusy(true);
    setNote(null);
    const res = await removeFraudBlockAction({ id });
    if (res.success) setBlocks((b) => b.filter((x) => x.id !== id));
    else setNote(res.error);
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Fraud guard
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
            Mode <FraudModeBadge mode={mode} />
          </div>
        </div>
        <CardDescription>
          Velocity limits and the destination blocklist checked on every OTP send. Prefixes with
          ≥30 sends and zero conversions are auto-blocked for 24h.
        </CardDescription>
      </CardHeader>
      <CardBody>
        {loading ? (
          <SabsmsTableSkeleton columns={5} rows={3} />
        ) : error ? (
          <SabsmsErrorState message={error} onRetry={() => void load()} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Block a prefix" help="E.164 prefix, e.g. +1415555">
                <Input
                  placeholder="+1415555"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-44"
                />
              </Field>
              <Button size="sm" disabled={busy || !prefix.trim()} onClick={() => void add()}>
                <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                Add block
              </Button>
              {note ? <ResultLine tone="err">{note}</ResultLine> : null}
            </div>

            {blocks.length === 0 ? (
              <SabsmsEmpty
                icon={<ShieldCheck />}
                title="No active blocks"
                description="Manual blocks you add and platform auto-blocks (zero-conversion prefixes) show up here."
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Prefix</Th>
                    <Th>Scope</Th>
                    <Th>Reason</Th>
                    <Th>Hits</Th>
                    <Th>Expires</Th>
                    <Th aria-label="Actions" />
                  </Tr>
                </THead>
                <TBody>
                  {blocks.map((b) => (
                    <Tr key={b.id}>
                      <Td>
                        <code>{b.prefix}</code>
                      </Td>
                      <Td>
                        <Badge
                          tone={b.scope === "workspace" ? "neutral" : "warning"}
                          kind="outline"
                        >
                          {b.scope}
                        </Badge>
                      </Td>
                      <Td>{b.reason}</Td>
                      <Td>{b.hits.toLocaleString()}</Td>
                      <Td>
                        {b.expiresAt ? new Date(b.expiresAt).toLocaleString() : "never"}
                      </Td>
                      <Td>
                        {b.scope === "workspace" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            aria-label={`Remove block ${b.prefix}`}
                            onClick={() => void remove(b.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}

            <div>
              <p className="text-sm font-medium mb-2">Recent fraud events</p>
              {events.length === 0 ? (
                <p className="text-xs text-[var(--st-text-secondary)]">
                  No guard hits logged in the last 30 days.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {events.map((e, i) => (
                    <li
                      key={`${e.at}-${i}`}
                      className="text-xs flex items-center gap-2 text-[var(--st-text-secondary)]"
                    >
                      {e.kind === "fraudBlockAdded" ? (
                        <ShieldAlert
                          className="h-3.5 w-3.5 shrink-0 text-[var(--st-warn)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <XCircle
                          className="h-3.5 w-3.5 shrink-0 text-[var(--st-danger)]"
                          aria-hidden="true"
                        />
                      )}
                      <span>{e.summary}</span>
                      <span className="ml-auto whitespace-nowrap">
                        {e.at ? new Date(e.at).toLocaleString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OtpVerifyPage() {
  const [stats, setStats] = React.useState<SabsmsOtpStats | null>(null);
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [statsError, setStatsError] = React.useState<string | null>(null);

  const loadStats = React.useCallback(async () => {
    const res = await getOtpStatsAction();
    if (res.success) {
      setStats(res.stats);
      setStatsError(null);
    } else {
      setStatsError(res.error);
    }
    setStatsLoading(false);
  }, []);

  React.useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const totals = (stats?.rows ?? []).reduce(
    (acc, r) => ({ sent: acc.sent + r.sent, converted: acc.converted + r.converted }),
    { sent: 0, converted: 0 },
  );

  return (
    <SabsmsPageShell
      title="OTP / Verify"
      eyebrow="Verification"
      description="Engine-native one-time passcodes: hashed codes, conversion-ranked routing, and an always-on fraud guard."
      breadcrumbs={[{ label: "OTP / Verify", href: "/sabsms/otp" }]}
      toolbar={<SabsmsRefreshButton onRefresh={loadStats} />}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="OTPs sent (window)"
            value={totals.sent.toLocaleString()}
            icon={Send}
          />
          <StatCard
            label="Verified"
            value={totals.converted.toLocaleString()}
            icon={CheckCircle2}
          />
          <StatCard
            label="Conversion rate"
            value={formatConversionRate(totals.sent, totals.converted)}
            icon={Activity}
          />
          <StatCard
            label="Fraud mode"
            value={stats?.fraudMode ?? "—"}
            icon={ShieldCheck}
          />
        </div>

        <ConfigCard />
        <ConversionCard
          stats={stats}
          loading={statsLoading}
          error={statsError}
          onRetry={() => void loadStats()}
        />
        <FraudCard mode={stats?.fraudMode ?? null} />
      </div>
    </SabsmsPageShell>
  );
}
