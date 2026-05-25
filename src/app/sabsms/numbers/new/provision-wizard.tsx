"use client";

/**
 * SabSMS — provisioning wizard (page 25).
 *
 * Single-page wizard that walks the user through provider, country,
 * type, capabilities, area-code search, multi-select of available
 * numbers, and the assignment + compliance + attestation knobs.
 *
 * Implements the 20 page-unique features listed in
 * `plans/sabsms-pages-catalog.md` §B.4 #25. The server side is in
 * `./actions.ts` — every mutation goes through a "use server" call.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
} from "lucide-react";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  ZoruRadioCard,
  RadioGroup,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from "@/components/zoruui";

import type { SabsmsNumberType, SabsmsProviderId } from "@/lib/sabsms/types";

import {
  provisionNumbers,
  searchAvailableNumbers,
  startTestCall,
  type CampaignOption,
  type PoolOption,
} from "./actions";
import {
  exceedsCostCap,
  getRecommendedProvider,
  isComplianceRequired,
  listProviders,
  validateProvisionInput,
  type AvailableNumber,
  type ProvisionCapabilities,
  type ProvisionInput,
} from "./helpers";

// ─── Constants ────────────────────────────────────────────────────────────

const COUNTRIES: Array<{ value: string; label: string }> = [
  { value: "US", label: "US — United States" },
  { value: "CA", label: "CA — Canada" },
  { value: "GB", label: "GB — United Kingdom" },
  { value: "IN", label: "IN — India" },
  { value: "AU", label: "AU — Australia" },
  { value: "DE", label: "DE — Germany" },
  { value: "FR", label: "FR — France" },
  { value: "SG", label: "SG — Singapore" },
];

const USE_CASES: Array<{ value: string; label: string }> = [
  { value: "transactional_otp", label: "Transactional / OTP" },
  { value: "marketing_promotional", label: "Marketing / promotional" },
  { value: "customer_support", label: "Customer support" },
  { value: "alert_notification", label: "Alerts and notifications" },
  { value: "internal_workflow", label: "Internal workflow" },
];

const TYPE_OPTIONS: Array<{
  value: SabsmsNumberType;
  label: string;
  description: string;
}> = [
  {
    value: "longcode",
    label: "Longcode",
    description: "Standard 10-digit number. Best general-purpose default.",
  },
  {
    value: "shortcode",
    label: "Shortcode",
    description: "5-6 digit high-throughput marketing channel (US/CA).",
  },
  {
    value: "tollfree",
    label: "Toll-free",
    description: "1-8XX number for 2-way support workflows.",
  },
  {
    value: "alphanumeric",
    label: "Alphanumeric",
    description: "Sender ID (one-way only). EU/IN where supported.",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────

export interface ProvisionWizardProps {
  campaigns: CampaignOption[];
  pools: PoolOption[];
  complianceReady: { tendlc: boolean; dlt: boolean };
}

interface WizardState {
  provider: SabsmsProviderId;
  country: string;
  type: SabsmsNumberType;
  capabilities: ProvisionCapabilities;
  pattern: string;
  selected: Set<string>;
  campaignId: string;
  poolId: string;
  defaultFooter: string;
  defaultSenderId: string;
  webhookUrlOverride: string;
  useCase: string;
  testCallTarget: string;
}

const initialState: WizardState = {
  provider: "twilio",
  country: "US",
  type: "longcode",
  capabilities: { sms: true, mms: false, rcs: false, voice: false },
  pattern: "",
  selected: new Set(),
  campaignId: "",
  poolId: "default",
  defaultFooter: "Reply STOP to opt out. Msg&data rates may apply.",
  defaultSenderId: "",
  webhookUrlOverride: "",
  useCase: "",
  testCallTarget: "",
};

// ─── Component ────────────────────────────────────────────────────────────

export function ProvisionWizard({
  campaigns,
  pools,
  complianceReady,
}: ProvisionWizardProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, setState] = React.useState<WizardState>(initialState);
  const [available, setAvailable] = React.useState<AvailableNumber[]>([]);
  const [searchPending, startSearch] = useTransition();
  const [provisionPending, startProvision] = useTransition();
  const [complianceDialogOpen, setComplianceDialogOpen] = React.useState(false);
  const [complianceMockLoading, setComplianceMockLoading] = React.useState(false);
  const [localComplianceReady, setLocalComplianceReady] = React.useState(complianceReady);

  const providers = React.useMemo(listProviders, []);

  const compliance = React.useMemo(
    () => isComplianceRequired({ country: state.country, type: state.type }),
    [state.country, state.type],
  );

  const complianceMissing =
    compliance.required &&
    ((compliance.key === "10dlc" && !localComplianceReady.tendlc) ||
      (compliance.key === "dlt" && !localComplianceReady.dlt));

  const selectedRows = React.useMemo(
    () => available.filter((n) => state.selected.has(n.e164)),
    [available, state.selected],
  );

  const monthlyCostEstimate = React.useMemo(
    () => selectedRows.reduce((sum, n) => sum + n.monthlyCost, 0),
    [selectedRows],
  );

  const costCap = exceedsCostCap(monthlyCostEstimate);

  const provisionInput: ProvisionInput = {
    provider: state.provider,
    country: state.country,
    type: state.type,
    numbers: Array.from(state.selected),
    capabilities: state.capabilities,
    campaignId: state.campaignId || undefined,
    poolId: state.poolId || undefined,
    webhookUrlOverride: state.webhookUrlOverride || undefined,
    defaultFooter: state.defaultFooter || undefined,
    defaultSenderId: state.defaultSenderId || undefined,
    useCase: state.useCase,
    monthlyCostEstimate,
  };

  const validationIssues = validateProvisionInput(provisionInput);
  const canProvision =
    validationIssues.length === 0 && !complianceMissing && !provisionPending;

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  function toggleCapability(key: keyof ProvisionCapabilities) {
    setState((s) => ({
      ...s,
      capabilities: { ...s.capabilities, [key]: !s.capabilities[key] },
    }));
  }

  function toggleSelected(e164: string) {
    setState((s) => {
      const next = new Set(s.selected);
      if (next.has(e164)) next.delete(e164);
      else next.add(e164);
      return { ...s, selected: next };
    });
  }

  function selectAllAvailable() {
    setState((s) => ({
      ...s,
      selected: new Set(available.map((n) => n.e164)),
    }));
  }

  function clearSelected() {
    setState((s) => ({ ...s, selected: new Set() }));
  }

  function handleRegisterCompliance() {
    setComplianceMockLoading(true);
    setTimeout(() => {
      setComplianceMockLoading(false);
      setComplianceDialogOpen(false);
      setLocalComplianceReady((prev) => ({
        ...prev,
        tendlc: compliance.key === "10dlc" ? true : prev.tendlc,
        dlt: compliance.key === "dlt" ? true : prev.dlt,
      }));
      toast({
        title: "Registration submitted",
        description: `Your ${compliance.key?.toUpperCase()} registration is now active.`,
      });
    }, 1500);
  }

  function runSearch() {
    startSearch(async () => {
      const res = await searchAvailableNumbers({
        provider: state.provider,
        country: state.country,
        type: state.type,
        pattern: state.pattern || undefined,
        capabilities: state.capabilities,
      });
      if (!res.ok) {
        toast({
          title: "Search failed",
          description: res.error,
          variant: "destructive",
        });
        setAvailable([]);
        return;
      }
      setAvailable(res.numbers);
      // Drop selections that are no longer in the result set.
      setState((s) => ({
        ...s,
        selected: new Set(
          [...s.selected].filter((e) => res.numbers.some((n) => n.e164 === e)),
        ),
      }));
      toast({ title: `${res.numbers.length} numbers available` });
    });
  }

  function submitProvision(draft: boolean) {
    if (validationIssues.length > 0) {
      toast({
        title: "Cannot provision",
        description: validationIssues.map((i) => i.message).join("; "),
        variant: "destructive",
      });
      return;
    }
    if (complianceMissing) {
      toast({
        title: "Compliance missing",
        description: `${compliance.key?.toUpperCase()} registration is required before provisioning in ${state.country}.`,
        variant: "destructive",
      });
      return;
    }
    startProvision(async () => {
      const res = await provisionNumbers({ ...provisionInput, draft });
      if (!res.ok) {
        toast({
          title: "Provisioning failed",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: draft
          ? "Draft saved for admin approval"
          : `Provisioned ${res.ids.length} number${res.ids.length === 1 ? "" : "s"}`,
      });
      // Optional test call after provisioning when voice is requested.
      if (
        !draft &&
        state.capabilities.voice &&
        state.testCallTarget.trim().length > 0 &&
        res.ids[0]
      ) {
        const tc = await startTestCall({
          numberId: res.ids[0],
          targetE164: state.testCallTarget,
        });
        if (!tc.ok) {
          toast({
            title: "Test call could not start",
            description: tc.error,
            variant: "destructive",
          });
        } else {
          toast({ title: "Test call queued (stub)" });
        }
      }
      router.push("/sabsms/numbers");
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Step 1 — Provider */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Provider</ZoruCardTitle>
          <ZoruCardDescription>
            Phase 1 ships with Twilio only. Other carriers light up in
            Phase 7.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <div className="space-y-4">
            <RadioGroup
              value={state.provider}
              onValueChange={(v) => patch({ provider: v as SabsmsProviderId })}
              className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
            >
              {providers.map((p) => (
                <ZoruRadioCard
                  key={p.id}
                  value={p.id}
                  label={
                    <span className="flex items-center gap-2">
                      {p.label}
                      {!p.available && (
                        <Badge variant="secondary">Phase 7</Badge>
                      )}
                    </span>
                  }
                  description={
                    p.available
                      ? "Available now."
                      : "Routing + provisioning ships in Phase 7."
                  }
                  disabled={!p.available}
                />
              ))}
            </RadioGroup>
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <strong className="font-semibold">Auto-suggest: </strong>
              {getRecommendedProvider(state.country).reason} (Recommended:{" "}
              {providers.find(p => p.id === getRecommendedProvider(state.country).provider)?.label})
            </div>
          </div>
        </ZoruCardContent>
      </Card>

      {/* Step 2 — Country + Type + Capabilities + Pattern */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Region and shape</ZoruCardTitle>
          <ZoruCardDescription>
            Country drives the cost band and the compliance check.
            Capabilities filter the search.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={state.country}
                onValueChange={(v) => patch({ country: v })}
              >
                <ZoruSelectTrigger id="country">
                  <ZoruSelectValue placeholder="Country" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {COUNTRIES.map((c) => (
                    <ZoruSelectItem key={c.value} value={c.value}>
                      {c.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pattern">Area code / pattern</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="pattern"
                  value={state.pattern}
                  onChange={(e) => patch({ pattern: e.target.value })}
                  placeholder="e.g. 415 or 1888"
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <RadioGroup
            value={state.type}
            onValueChange={(v) => patch({ type: v as SabsmsNumberType })}
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
          >
            {TYPE_OPTIONS.map((t) => (
              <ZoruRadioCard
                key={t.value}
                value={t.value}
                label={t.label}
                description={t.description}
              />
            ))}
          </RadioGroup>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["sms", "mms", "rcs", "voice"] as const).map((cap) => (
              <label
                key={cap}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={state.capabilities[cap]}
                  onCheckedChange={() => toggleCapability(cap)}
                  aria-label={`${cap} capability`}
                />
                <span className="uppercase tracking-wide">{cap}</span>
              </label>
            ))}
          </div>

          {state.type === "alphanumeric" && (
            <div className="space-y-2">
              <Label htmlFor="senderId">Default sender ID (alpha)</Label>
              <Input
                id="senderId"
                value={state.defaultSenderId}
                onChange={(e) => patch({ defaultSenderId: e.target.value })}
                placeholder="e.g. SABSMS"
                maxLength={11}
              />
              <p className="text-xs text-slate-500">
                One-way only. Max 11 chars. Country support varies.
              </p>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      {/* Compliance pre-check */}
      {compliance.required && (
        <Alert variant={complianceMissing ? "destructive" : "success"}>
          {complianceMissing ? (
            <AlertTriangle aria-hidden />
          ) : (
            <ShieldCheck aria-hidden />
          )}
          <ZoruAlertTitle>
            {compliance.key === "10dlc"
              ? "10DLC brand and campaign"
              : "Indian DLT registration"}{" "}
            {complianceMissing ? "missing" : "ready"}
          </ZoruAlertTitle>
          <ZoruAlertDescription>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                {complianceMissing
                  ? `Register your ${compliance.key?.toUpperCase()} entity before provisioning a longcode in ${state.country}. Drafts are still allowed.`
                  : `${compliance.key?.toUpperCase()} registration looks ready for this workspace.`}
              </div>
              {complianceMissing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setComplianceDialogOpen(true)}
                  className="bg-white/50 w-fit"
                >
                  Start Registration
                </Button>
              )}
            </div>
          </ZoruAlertDescription>
        </Alert>
      )}

      {/* Step 3 — Search results */}
      <Card>
        <ZoruCardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <ZoruCardTitle>Available numbers</ZoruCardTitle>
            <ZoruCardDescription>
              Phase 1 mock — the engine doesn{`’`}t expose
              /v1/numbers/search yet. Results are deterministic per
              country + pattern.
            </ZoruCardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={runSearch}
              disabled={searchPending}
            >
              {searchPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>
        </ZoruCardHeader>
        <ZoruCardContent>
          {available.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-500">
              <Phone className="h-6 w-6 text-slate-300" />
              <div>No results yet — pick the shape above and search.</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={selectAllAvailable}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearSelected}
                  >
                    Clear
                  </Button>
                </div>
                <div>
                  Selected {state.selected.size}/{available.length}
                </div>
              </div>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-10 px-3 py-2"></th>
                      <th className="px-3 py-2 text-left">Number</th>
                      <th className="px-3 py-2 text-left">Country</th>
                      <th className="px-3 py-2 text-left">Caps</th>
                      <th className="px-3 py-2 text-right">Monthly cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {available.map((n) => {
                      const checked = state.selected.has(n.e164);
                      return (
                        <tr
                          key={n.e164}
                          className={checked ? "bg-amber-50/50" : undefined}
                        >
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleSelected(n.e164)}
                              aria-label={`Select ${n.e164}`}
                            />
                          </td>
                          <td className="px-3 py-2 font-mono">{n.e164}</td>
                          <td className="px-3 py-2 text-xs">{n.country}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {(["sms", "mms", "rcs", "voice"] as const)
                                .filter((c) => n.capabilities[c])
                                .map((c) => (
                                  <Badge
                                    key={c}
                                    variant="secondary"
                                    className="text-[10px] uppercase"
                                  >
                                    {c}
                                  </Badge>
                                ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            ${(n.monthlyCost / 100).toFixed(2)}/mo
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      {/* Step 4 — Assignment + webhook + footer + test call */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Assignment and defaults</ZoruCardTitle>
          <ZoruCardDescription>
            Optional — these can be edited later from the number{`’`}s
            detail page.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign">Assign to campaign</Label>
              <Select
                value={state.campaignId}
                onValueChange={(v) => patch({ campaignId: v })}
              >
                <ZoruSelectTrigger id="campaign">
                  <ZoruSelectValue placeholder="No campaign" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="">No campaign</ZoruSelectItem>
                  {campaigns.map((c) => (
                    <ZoruSelectItem key={c.id} value={c.id}>
                      {c.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool">Assign to sender pool</Label>
              <Select
                value={state.poolId}
                onValueChange={(v) => patch({ poolId: v })}
              >
                <ZoruSelectTrigger id="pool">
                  <ZoruSelectValue placeholder="Pool" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {pools.map((p) => (
                    <ZoruSelectItem key={p.id} value={p.id}>
                      {p.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook URL override</Label>
            <Input
              id="webhook"
              value={state.webhookUrlOverride}
              onChange={(e) =>
                patch({ webhookUrlOverride: e.target.value })
              }
              placeholder="https://… (leave blank to use workspace defaults)"
            />
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              <div className="font-medium text-slate-600">
                Auto-configured webhook preview
              </div>
              <ul className="mt-1 space-y-1 font-mono">
                <li>Inbound — /api/sabsms/webhooks/twilio/inbound</li>
                <li>DLR — /api/sabsms/webhooks/twilio/dlr</li>
                <li>Voice — /api/sabsms/webhooks/twilio/voice (Phase 7)</li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer">Default footer policy</Label>
            <Textarea
              id="footer"
              rows={2}
              value={state.defaultFooter}
              onChange={(e) => patch({ defaultFooter: e.target.value })}
              placeholder="Reply STOP to opt out. Msg&data rates may apply."
            />
          </div>

          {state.capabilities.voice && (
            <div className="space-y-2">
              <Label htmlFor="test-call">Test call (after provision)</Label>
              <Input
                id="test-call"
                value={state.testCallTarget}
                onChange={(e) => patch({ testCallTarget: e.target.value })}
                placeholder="+15555550100"
              />
              <p className="text-xs text-slate-500">
                Engine doesn{`’`}t support voice yet (Phase 7) — this
                queues an audit-log entry only.
              </p>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      {/* Step 5 — Attestation */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Compliance attestation</ZoruCardTitle>
          <ZoruCardDescription>
            Required — what is this number going to be used for?
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="usecase">Primary use case</Label>
            <Select
              value={state.useCase}
              onValueChange={(v) => patch({ useCase: v })}
            >
              <ZoruSelectTrigger id="usecase">
                <ZoruSelectValue placeholder="Pick a use case" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {USE_CASES.map((u) => (
                  <ZoruSelectItem key={u.value} value={u.value}>
                    {u.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>

          {costCap && (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <ZoruAlertTitle>Cost cap warning</ZoruAlertTitle>
              <ZoruAlertDescription>
                Estimated monthly cost{" "}
                <span className="font-mono">
                  ${(monthlyCostEstimate / 100).toFixed(2)}
                </span>{" "}
                exceeds the $100 cap. Use Save as draft and ask an admin
                to review.
              </ZoruAlertDescription>
            </Alert>
          )}

          <Alert variant="info">
            <CheckCircle2 aria-hidden />
            <ZoruAlertTitle>Audit log</ZoruAlertTitle>
            <ZoruAlertDescription>
              Every provision (and every test call) writes an entry to{" "}
              <code className="rounded bg-slate-100 px-1">sabsms_audit_log</code>{" "}
              with the workspace, provider, country, type, attested use
              case and the numbers touched.
            </ZoruAlertDescription>
          </Alert>
        </ZoruCardContent>
      </Card>

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Badge variant="secondary">
            <MapPin className="mr-1 h-3 w-3" />
            {state.country} / {state.type}
          </Badge>
          <Badge variant="secondary">
            {state.selected.size} selected
          </Badge>
          <span className="font-mono">
            est. ${(monthlyCostEstimate / 100).toFixed(2)}/mo
          </span>
          {validationIssues.length > 0 && (
            <span className="text-amber-700">
              {validationIssues[0].message}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => submitProvision(true)}
            disabled={state.selected.size === 0 || provisionPending}
          >
            Save as draft
          </Button>
          <Button
            type="button"
            onClick={() => submitProvision(false)}
            disabled={!canProvision}
          >
            {provisionPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            <span className={provisionPending ? "ml-2" : undefined}>
              Provision {state.selected.size > 0 ? state.selected.size : ""}
            </span>
          </Button>
        </div>
      </div>

      <Dialog open={complianceDialogOpen} onOpenChange={setComplianceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register for {compliance.key?.toUpperCase()}</DialogTitle>
            <DialogDescription>
              Complete your compliance registration to unlock provisioning in {state.country}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input placeholder="Acme Corp" />
            </div>
            <div className="space-y-2">
              <Label>Tax ID / Registration Number</Label>
              <Input placeholder="XX-XXXXXXX" />
            </div>
            <p className="text-xs text-slate-500">
              This is a mock registration flow for Phase 1. Submitting will mark your workspace as compliant instantly.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setComplianceDialogOpen(false)}
              disabled={complianceMockLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleRegisterCompliance} disabled={complianceMockLoading}>
              {complianceMockLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
