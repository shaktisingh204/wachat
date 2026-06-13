"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Network,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import { SabsmsDataTable, type SabsmsColumn } from "@/components/sabsms/page-toolkit/sabsms-data-table";
import { SabsmsDetailDrawer } from "@/components/sabsms/page-toolkit/sabsms-detail-drawer";
import { SabsmsRefreshButton } from "@/components/sabsms/page-toolkit/sabsms-refresh-button";
import { SabsmsEmpty, SabsmsErrorState, SabsmsTableSkeleton } from "@/components/sabsms/page-toolkit/sabsms-states";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  IconButton,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/sabcrm/20ui";

import {
  getRoutingHealthAction,
  getRoutingPolicyAction,
  listNumbersForPoolAction,
  previewRouteAction,
  saveRoutingPolicyAction,
  type PoolNumberOption,
  type RoutingRuleInput,
} from "./actions";
import { listProviderAccountsAction } from "../providers/actions";
import type {
  SabsmsProviderHealthAccount,
  SabsmsRoutePreviewCandidate,
} from "@/lib/sabsms/engine-client";

/** Wildcard sentinel for the 20ui Select (it can't hold ""). */
const ANY = "__any__";

const COUNTRIES = [
  { value: "US", label: "United States (+1)" },
  { value: "CA", label: "Canada (+1)" },
  { value: "GB", label: "United Kingdom (+44)" },
  { value: "IN", label: "India (+91)" },
  { value: "AU", label: "Australia (+61)" },
  { value: "DE", label: "Germany (+49)" },
  { value: "FR", label: "France (+33)" },
  { value: "BR", label: "Brazil (+55)" },
  { value: "AE", label: "UAE (+971)" },
  { value: "SG", label: "Singapore (+65)" },
];

const CATEGORIES = ["transactional", "otp", "marketing", "alert", "service"];
const CHANNELS = ["sms", "mms", "rcs"];

type PoolStrategy = "round_robin" | "sticky" | "least_used";

const POOL_STRATEGY_OPTIONS: Array<{ value: PoolStrategy; label: string; hint: string }> = [
  { value: "round_robin", label: "Round-robin", hint: "Rotate evenly across the pool" },
  { value: "sticky", label: "Sticky (per-recipient)", hint: "Same number per contact (hashed)" },
  { value: "least_used", label: "Least-used", hint: "Pick the lowest-volume number" },
];

interface AccountRow {
  id: string;
  provider: string;
  isDefault: boolean;
  status: string;
}

/** Client-side mirror of the engine score: Laplace smoothing + min-volume neutrality. */
function scoreOf(delivered: number, failed: number): number {
  const volume = delivered + failed;
  if (volume < 20) return 1.0;
  return (delivered + 1) / (volume + 2);
}

function accountHealth(
  health: SabsmsProviderHealthAccount[],
  accountId: string,
  country?: string,
): { score: number; circuit: "closed" | "open" | "half_open"; hasTraffic: boolean } {
  const acct = health.find((h) => h.accountId === accountId);
  if (!acct || acct.byCountry.length === 0) {
    return { score: 1.0, circuit: "closed", hasTraffic: false };
  }
  if (country) {
    const row = acct.byCountry.find((c) => c.country.toUpperCase() === country.toUpperCase());
    if (!row) return { score: 1.0, circuit: "closed", hasTraffic: false };
    return { score: row.score, circuit: row.circuit, hasTraffic: row.sent + row.delivered + row.failed > 0 };
  }
  let delivered = 0;
  let failed = 0;
  let worst: "closed" | "open" | "half_open" = "closed";
  for (const row of acct.byCountry) {
    delivered += row.delivered;
    failed += row.failed;
    if (row.circuit === "open") worst = "open";
    else if (row.circuit === "half_open" && worst === "closed") worst = "half_open";
  }
  return { score: scoreOf(delivered, failed), circuit: worst, hasTraffic: delivered + failed > 0 };
}

function CircuitChip({ circuit }: { circuit: "closed" | "open" | "half_open" }) {
  if (circuit === "open") {
    return (
      <Badge tone="danger" kind="outline">
        <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />
        open
      </Badge>
    );
  }
  if (circuit === "half_open") {
    return (
      <Badge tone="warning" kind="outline">
        <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
        probing
      </Badge>
    );
  }
  return (
    <Badge tone="success" kind="outline">
      <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
      closed
    </Badge>
  );
}

function HealthBadge({
  health,
  accountId,
  country,
}: {
  health: SabsmsProviderHealthAccount[];
  accountId: string;
  country?: string;
}) {
  const { score, circuit, hasTraffic } = accountHealth(health, accountId, country);
  if (circuit !== "closed") return <CircuitChip circuit={circuit} />;
  if (!hasTraffic) {
    return (
      <Badge tone="neutral" kind="outline">
        no traffic
      </Badge>
    );
  }
  const pct = Math.round(score * 100);
  const tone = score >= 0.95 ? "success" : score >= 0.85 ? "warning" : "danger";
  return (
    <Badge tone={tone} kind="outline">
      {pct}% DLR
    </Badge>
  );
}

function matchSummary(rule: RoutingRuleInput): string {
  const parts: string[] = [];
  if (rule.match.country) parts.push(`country=${rule.match.country}`);
  if (rule.match.category) parts.push(`category=${rule.match.category}`);
  if (rule.match.channel) parts.push(`channel=${rule.match.channel}`);
  if (rule.match.prefix) parts.push(`prefix=${rule.match.prefix}`);
  return parts.length ? parts.join(" · ") : "All traffic";
}

function newRuleId(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyRule(): RoutingRuleInput {
  return { id: newRuleId(), match: {}, routes: [], stickySender: false };
}

/* ------------------------------------------------------------------ */
/* Rule editor (detail drawer body)                                   */
/* ------------------------------------------------------------------ */

function RuleEditor({
  draft,
  setDraft,
  accounts,
  health,
  poolNumbers,
}: {
  draft: RoutingRuleInput;
  setDraft: (r: RoutingRuleInput) => void;
  accounts: AccountRow[];
  health: SabsmsProviderHealthAccount[];
  poolNumbers: PoolNumberOption[];
}) {
  const poolEnabled = !!draft.pool;
  const poolStrategy: PoolStrategy = draft.pool?.strategy ?? "round_robin";
  const poolNumberIds = draft.pool?.numberIds ?? [];

  const setPoolEnabled = (on: boolean) => {
    if (on) {
      setDraft({
        ...draft,
        pool: { strategy: poolStrategy, numberIds: poolNumberIds },
      });
    } else {
      const { pool: _omit, ...rest } = draft;
      void _omit;
      setDraft(rest);
    }
  };

  const setPoolStrategy = (strategy: PoolStrategy) => {
    setDraft({
      ...draft,
      pool: { strategy, numberIds: draft.pool?.numberIds ?? [] },
    });
  };

  const togglePoolNumber = (numberId: string) => {
    const current = draft.pool?.numberIds ?? [];
    const next = current.includes(numberId)
      ? current.filter((id) => id !== numberId)
      : [...current, numberId];
    setDraft({
      ...draft,
      pool: { strategy: draft.pool?.strategy ?? "round_robin", numberIds: next },
    });
  };

  const setMatch = (key: keyof RoutingRuleInput["match"], value: string | undefined) => {
    const match = { ...draft.match };
    if (!value) delete match[key];
    else match[key] = value;
    setDraft({ ...draft, match });
  };

  const setRoute = (idx: number, patch: Partial<{ providerAccountId: string; weight: number }>) => {
    const routes = draft.routes.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setDraft({ ...draft, routes });
  };

  const moveRoute = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draft.routes.length) return;
    const routes = [...draft.routes];
    [routes[idx], routes[target]] = [routes[target], routes[idx]];
    setDraft({ ...draft, routes });
  };

  const accountLabel = (a: AccountRow) =>
    `${a.provider}${a.isDefault ? " (default)" : ""} · ${a.id.slice(-6)}`;

  return (
    <div className="space-y-6 py-4">
      <div className="pt-1">
        <h4 className="text-sm font-medium mb-3">Conditions</h4>
        <p className="text-xs text-[var(--st-text-secondary)] mb-3">
          Every set condition must match. Leave a field on “Any” to wildcard it.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Destination country">
            <Select
              value={draft.match.country ?? ANY}
              onValueChange={(v) => setMatch("country", v === ANY ? undefined : v)}
            >
              <SelectTrigger aria-label="Destination country">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Category">
            <Select
              value={draft.match.category ?? ANY}
              onValueChange={(v) => setMatch("category", v === ANY ? undefined : v)}
            >
              <SelectTrigger aria-label="Category">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Channel">
            <Select
              value={draft.match.channel ?? ANY}
              onValueChange={(v) => setMatch("channel", v === ANY ? undefined : v)}
            >
              <SelectTrigger aria-label="Channel">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Number prefix (E.164)">
            <Input
              type="text"
              placeholder="+9198"
              value={draft.match.prefix ?? ""}
              onChange={(e) => setMatch("prefix", e.target.value.trim() || undefined)}
            />
          </Field>
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--st-border)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-medium">Routes</h4>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
              Highest weight sends first; the rest are failover targets in order.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Plus}
            disabled={accounts.length === 0}
            onClick={() =>
              setDraft({
                ...draft,
                routes: [
                  ...draft.routes,
                  { providerAccountId: accounts[0]?.id ?? "", weight: 100 },
                ],
              })
            }
          >
            Add route
          </Button>
        </div>

        {draft.routes.length === 0 ? (
          <div className="text-sm text-[var(--st-text-secondary)] border border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] p-4">
            No routes yet — add at least one provider account.
          </div>
        ) : (
          <div className="space-y-2">
            {draft.routes.map((route, i) => (
              <div
                key={`${route.providerAccountId}-${i}`}
                className="flex items-center gap-2 p-2.5 border rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border-[var(--st-border)]"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium border bg-[var(--st-bg-secondary)] border-[var(--st-border)] text-[var(--st-text)]">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <Select
                    value={route.providerAccountId || undefined}
                    onValueChange={(v) => setRoute(i, { providerAccountId: v })}
                  >
                    <SelectTrigger aria-label={`Route ${i + 1} provider account`}>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {accountLabel(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    min={0}
                    aria-label={`Route ${i + 1} weight`}
                    value={String(route.weight)}
                    onChange={(e) =>
                      setRoute(i, { weight: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </div>
                {route.providerAccountId ? (
                  <HealthBadge
                    health={health}
                    accountId={route.providerAccountId}
                    country={draft.match.country}
                  />
                ) : null}
                <div className="flex items-center gap-0.5">
                  <IconButton
                    label={`Move route ${i + 1} up`}
                    icon={ArrowUp}
                    size="sm"
                    onClick={() => moveRoute(i, -1)}
                    disabled={i === 0}
                  />
                  <IconButton
                    label={`Move route ${i + 1} down`}
                    icon={ArrowDown}
                    size="sm"
                    onClick={() => moveRoute(i, 1)}
                    disabled={i === draft.routes.length - 1}
                  />
                  <IconButton
                    label={`Remove route ${i + 1}`}
                    icon={X}
                    size="sm"
                    onClick={() =>
                      setDraft({ ...draft, routes: draft.routes.filter((_, j) => j !== i) })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[var(--st-border)] flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Sticky sender</h4>
          <p className="text-xs text-[var(--st-text-secondary)] mt-1">
            Pin each contact to the account + number that last reached them (30 days).
          </p>
        </div>
        <Switch
          checked={draft.stickySender}
          onCheckedChange={(v) => setDraft({ ...draft, stickySender: !!v })}
          aria-label="Sticky sender"
        />
      </div>

      <div className="pt-4 border-t border-[var(--st-border)]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h4 className="text-sm font-medium">Sender pool</h4>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
              Spread this rule&apos;s sends across several of your numbers. The
              engine picks the <span className="font-mono">from</span> using the
              strategy below.
            </p>
          </div>
          <Switch
            checked={poolEnabled}
            onCheckedChange={(v) => setPoolEnabled(!!v)}
            aria-label="Enable sender pool"
          />
        </div>

        {poolEnabled ? (
          <div className="mt-3 space-y-4">
            <Field label="Pool strategy">
              <Select value={poolStrategy} onValueChange={(v) => setPoolStrategy(v as PoolStrategy)}>
                <SelectTrigger aria-label="Pool strategy">
                  <SelectValue placeholder="Strategy" />
                </SelectTrigger>
                <SelectContent>
                  {POOL_STRATEGY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--st-text-secondary)] mt-1">
                {POOL_STRATEGY_OPTIONS.find((o) => o.value === poolStrategy)?.hint}
              </p>
            </Field>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--st-text)]">
                  Pool numbers
                </span>
                <span className="text-xs text-[var(--st-text-secondary)]">
                  {poolNumberIds.length} selected
                </span>
              </div>
              {poolNumbers.length === 0 ? (
                <div className="text-sm text-[var(--st-text-secondary)] border border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] p-4">
                  No active numbers yet — buy or activate numbers under Numbers to
                  build a pool.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-[var(--st-border)] rounded-[var(--st-radius)] p-2">
                  {poolNumbers.map((n) => {
                    const checked = poolNumberIds.includes(n.id);
                    return (
                      <label
                        key={n.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--st-radius)] hover:bg-[var(--st-bg-secondary)] cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => togglePoolNumber(n.id)}
                          aria-label={`Include ${n.e164} in pool`}
                        />
                        <span className="font-mono text-sm text-[var(--st-text)]">{n.e164}</span>
                        <span className="ml-auto text-xs text-[var(--st-text-secondary)] capitalize">
                          {n.provider}
                          {n.country ? ` · ${n.country}` : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {poolEnabled && poolNumberIds.length === 0 && poolNumbers.length > 0 ? (
                <p className="text-xs text-[var(--st-warn)] mt-1">
                  Select at least one number, or turn the pool off.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Route trace tool — engine-backed preview                            */
/* ------------------------------------------------------------------ */

function RouteTraceTool({ accounts }: { accounts: AccountRow[] }) {
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [category, setCategory] = React.useState<string>("transactional");
  const [channel, setChannel] = React.useState<string>("sms");
  const [candidates, setCandidates] = React.useState<SabsmsRoutePreviewCandidate[] | null>(null);
  const [country, setCountry] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isTracing, setIsTracing] = React.useState(false);

  const providerOf = (c: SabsmsRoutePreviewCandidate) => {
    if (!c.providerAccountId) return `${c.provider} (workspace default)`;
    const acct = accounts.find((a) => a.id === c.providerAccountId);
    return acct
      ? `${acct.provider} · ${acct.id.slice(-6)}`
      : `${c.provider} · ${c.providerAccountId.slice(-6)}`;
  };

  const handleTrace = async () => {
    setIsTracing(true);
    setError(null);
    setCandidates(null);
    const res = await previewRouteAction({ to: phoneNumber.trim(), category, channel });
    if (res.success) {
      setCandidates(res.preview.candidates);
      setCountry(res.preview.country);
    } else {
      setError(res.error);
    }
    setIsTracing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" aria-hidden="true" /> Routing trace
        </CardTitle>
        <CardDescription>
          Where would this message route? Runs the engine&apos;s real selector — nothing is sent.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <Field label="Destination number">
          <Input
            type="text"
            placeholder="+1 415 555 2671"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Trace category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger aria-label="Trace channel">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button variant="outline" block onClick={handleTrace} disabled={isTracing || !phoneNumber.trim()}>
          {isTracing ? "Tracing…" : "Run trace"}
        </Button>

        {error ? (
          <div className="text-sm text-[var(--st-danger)] flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {candidates ? (
          <div className="mt-2 space-y-2 border-t border-[var(--st-border)] pt-4">
            <h4 className="text-sm font-semibold mb-1">
              Candidate order{country ? ` · ${country}` : ""}
            </h4>
            {candidates.length === 0 ? (
              <div className="text-sm text-[var(--st-text-secondary)]">
                No candidates — the destination provider has no adapter and no rule matched.
              </div>
            ) : (
              candidates.map((c, i) => (
                <div
                  key={`${c.providerAccountId ?? "default"}-${i}`}
                  className="p-3 rounded-[var(--st-radius)] text-sm border bg-[var(--st-bg-secondary)] border-[var(--st-border)]"
                >
                  <div className="flex items-center gap-2 font-medium mb-1">
                    {i === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--st-status-ok)]" aria-hidden="true" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center text-[10px] text-[var(--st-text-secondary)]">
                        {i + 1}
                      </span>
                    )}
                    <span className="text-[var(--st-text)] truncate">{providerOf(c)}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {c.source}
                      </Badge>
                      <CircuitChip circuit={c.circuit} />
                    </span>
                  </div>
                  <div className="text-xs text-[var(--st-text-secondary)] ml-6">
                    {c.score != null ? `health ${(c.score * 100).toFixed(0)}%` : "no health window"}
                    {c.fromOverride ? ` · from ${c.fromOverride}` : ""}
                    {c.ruleId ? ` · rule ${c.ruleId}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function RoutingPage() {
  const [rules, setRules] = React.useState<RoutingRuleInput[]>([]);
  const [accounts, setAccounts] = React.useState<AccountRow[]>([]);
  const [health, setHealth] = React.useState<SabsmsProviderHealthAccount[]>([]);
  const [poolNumbers, setPoolNumbers] = React.useState<PoolNumberOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<RoutingRuleInput>(emptyRule());

  const load = React.useCallback(async () => {
    setLoadError(null);
    const [policyRes, accountsRes, healthRes, numbersRes] = await Promise.all([
      getRoutingPolicyAction(),
      listProviderAccountsAction(),
      getRoutingHealthAction(),
      listNumbersForPoolAction(),
    ]);
    if (policyRes.success) setRules(policyRes.rules);
    else setLoadError(policyRes.error);
    if (accountsRes.success) {
      setAccounts(
        accountsRes.accounts.map((a) => ({
          id: a.id,
          provider: a.provider,
          isDefault: a.isDefault,
          status: a.status,
        })),
      );
    }
    if (healthRes.success) setHealth(healthRes.accounts);
    if (numbersRes.success) setPoolNumbers(numbersRes.numbers);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Live health badges: refresh on an interval (best-effort).
  React.useEffect(() => {
    const interval = setInterval(async () => {
      if (document.hidden) return;
      const res = await getRoutingHealthAction();
      if (res.success) setHealth(res.accounts);
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  /** Persist a full new rule list (order IS priority). */
  const persist = React.useCallback(
    async (next: RoutingRuleInput[]): Promise<boolean> => {
      setSaving(true);
      setSaveError(null);
      const prev = rules;
      setRules(next); // optimistic
      const res = await saveRoutingPolicyAction(next);
      setSaving(false);
      if (!res.success) {
        setRules(prev);
        setSaveError(res.error);
        return false;
      }
      return true;
    },
    [rules],
  );

  const moveRule = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[idx], next[target]] = [next[target], next[idx]];
    void persist(next);
  };

  const deleteRule = (id: string) => {
    void persist(rules.filter((r) => r.id !== id));
  };

  const openEditor = (rule: RoutingRuleInput | null) => {
    if (rule) {
      setDraft(JSON.parse(JSON.stringify(rule)) as RoutingRuleInput);
      setEditingId(rule.id);
    } else {
      setDraft(emptyRule());
      setEditingId("new");
    }
  };

  const saveDraft = async () => {
    if (draft.routes.length === 0 || draft.routes.some((r) => !r.providerAccountId)) {
      setSaveError("Every route needs a provider account (at least one route per rule).");
      return;
    }
    if (draft.pool && draft.pool.numberIds.length === 0) {
      setSaveError("Sender pool is on but has no numbers — pick at least one or turn the pool off.");
      return;
    }
    const next =
      editingId === "new"
        ? [...rules, draft]
        : rules.map((r) => (r.id === editingId ? draft : r));
    const ok = await persist(next);
    if (ok) setEditingId(null);
  };

  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.provider} · ${id.slice(-6)}` : `account · ${id.slice(-6)}`;
  };

  const columns: SabsmsColumn<RoutingRuleInput>[] = [
    {
      id: "priority",
      header: "Priority",
      width: "90px",
      render: (row) => {
        const idx = rules.findIndex((r) => r.id === row.id);
        return (
          <div className="flex items-center gap-1">
            <span className="w-5 text-sm font-medium text-[var(--st-text-secondary)]">{idx + 1}</span>
            <IconButton
              label={`Move rule ${idx + 1} up`}
              icon={ArrowUp}
              size="sm"
              onClick={() => moveRule(idx, -1)}
              disabled={idx === 0 || saving}
            />
            <IconButton
              label={`Move rule ${idx + 1} down`}
              icon={ArrowDown}
              size="sm"
              onClick={() => moveRule(idx, 1)}
              disabled={idx === rules.length - 1 || saving}
            />
          </div>
        );
      },
    },
    {
      id: "conditions",
      header: "Conditions",
      render: (row) => <span className="text-sm">{matchSummary(row)}</span>,
    },
    {
      id: "routes",
      header: "Routes (weight)",
      render: (row) => (
        <div className="flex flex-col gap-1">
          {row.routes.map((rt, i) => (
            <div key={`${rt.providerAccountId}-${i}`} className="flex items-center gap-2 text-sm">
              <span className="text-xs text-[var(--st-text-secondary)] w-4">{i + 1}.</span>
              <span className="truncate">{accountLabel(rt.providerAccountId)}</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                w{rt.weight}
              </Badge>
              <HealthBadge
                health={health}
                accountId={rt.providerAccountId}
                country={row.match.country}
              />
            </div>
          ))}
          {row.pool ? (
            <div className="flex items-center gap-1 pt-0.5">
              <Badge tone="accent" kind="outline" className="text-[10px]">
                pool · {row.pool.strategy.replace("_", "-")}
              </Badge>
              <span className="text-[10px] text-[var(--st-text-secondary)]">
                {row.pool.numberIds.length} number{row.pool.numberIds.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "sticky",
      header: "Sticky",
      width: "90px",
      render: (row) =>
        row.stickySender ? (
          <Badge tone="accent" kind="outline">
            sticky
          </Badge>
        ) : (
          <span className="text-xs text-[var(--st-text-secondary)]">—</span>
        ),
    },
  ];

  return (
    <SabsmsPageShell
      title="Routing Rules"
      eyebrow="Infrastructure"
      description="Cross-provider failover routing: ordered rules pick weighted provider accounts per destination; unhealthy accounts are skipped automatically."
      breadcrumbs={[{ label: "Infrastructure" }, { label: "Routing" }]}
      primaryAction={{ label: "Create Rule", onClick: () => openEditor(null) }}
      helpTitle="About routing rules"
      helpBody="Rules are evaluated top-to-bottom; the first rule whose conditions all match wins. Its routes are tried highest-weight first, failing over on synchronous provider rejections. Messages without a matching rule use the workspace default account — they never fail for lack of a policy."
      toolbar={
        <div className="flex items-center gap-2 mb-4">
          <SabsmsRefreshButton onRefresh={load} />
          {saving ? (
            <span className="text-xs text-[var(--st-text-secondary)]">Saving…</span>
          ) : null}
        </div>
      }
    >
      {saveError ? (
        <div className="mb-4">
          <SabsmsErrorState message={saveError} onRetry={() => setSaveError(null)} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-4">
          {loading ? (
            <SabsmsTableSkeleton columns={4} rows={4} />
          ) : loadError ? (
            <SabsmsErrorState message={loadError} onRetry={load} />
          ) : rules.length === 0 ? (
            <SabsmsEmpty
              icon={<Network />}
              title="No routing rules yet"
              description="All traffic currently uses each message's provider account (workspace default). Create a rule to route by country, category or prefix with cross-provider failover."
              action={{ label: "Create rule", onClick: () => openEditor(null) }}
            />
          ) : (
            <Card>
              <SabsmsDataTable
                columns={columns}
                rows={rules}
                rowKey={(r) => r.id}
                onRowClick={(row) => openEditor(row)}
                rowActions={[
                  { label: "Edit rule", onSelect: (r) => openEditor(r) },
                  {
                    label: "Delete",
                    onSelect: (r) => deleteRule(r.id),
                    destructive: true,
                  },
                ]}
              />
              <div className="p-4 border-t border-[var(--st-border)] text-sm text-[var(--st-text-secondary)]">
                Rules are evaluated top-to-bottom — the first match wins. Reorder with the arrows.
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <RouteTraceTool accounts={accounts} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" aria-hidden="true" /> Fallback
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="text-sm text-[var(--st-text-secondary)]">
                When no rule matches, messages use their own provider account (or the workspace
                default for that provider) — the pre-routing behaviour. Sends never fail for lack
                of a policy.
              </div>
              {accounts.length === 0 ? (
                <div className="text-sm text-[var(--st-warn)] flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    No provider accounts configured yet — add one under Providers before creating
                    rules.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {accounts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="truncate">
                        {a.provider} · {a.id.slice(-6)}
                      </span>
                      {a.isDefault ? (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          default
                        </Badge>
                      ) : null}
                      <HealthBadge health={health} accountId={a.id} />
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <SabsmsDetailDrawer
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
        title={editingId === "new" ? "Create rule" : "Edit rule"}
        description="Conditions, weighted failover routes, and sticky-sender behaviour."
      >
        <RuleEditor
          draft={draft}
          setDraft={setDraft}
          accounts={accounts}
          health={health}
          poolNumbers={poolNumbers}
        />
        <div className="flex gap-2 justify-between w-full pt-4 mt-2 border-t border-[var(--st-border)]">
          {editingId !== "new" && editingId ? (
            <Button
              variant="ghost"
              iconLeft={Trash2}
              onClick={() => {
                deleteRule(editingId);
                setEditingId(null);
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button onClick={saveDraft} disabled={saving}>
              {saving ? "Saving…" : "Save rule"}
            </Button>
          </div>
        </div>
      </SabsmsDetailDrawer>
    </SabsmsPageShell>
  );
}
