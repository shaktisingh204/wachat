"use client";

/**
 * SabSMS - provisioning wizard (page 25).
 *
 * Single-page wizard that walks the user through provider, country,
 * type, capabilities, area-code search, multi-select of available
 * numbers, and the assignment + compliance + attestation knobs.
 *
 * Implements the 20 page-unique features listed in
 * `plans/sabsms-pages-catalog.md` §B.4 #25. The server side is in
 * `./actions.ts` - every mutation goes through a "use server" call.
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
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Radio,
  RadioGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TBody,
  THead,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  useToast,
} from "@/components/sabcrm/20ui";

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
  { value: "US", label: "US - United States" },
  { value: "CA", label: "CA - Canada" },
  { value: "GB", label: "GB - United Kingdom" },
  { value: "IN", label: "IN - India" },
  { value: "AU", label: "AU - Australia" },
  { value: "DE", label: "DE - Germany" },
  { value: "FR", label: "FR - France" },
  { value: "SG", label: "SG - Singapore" },
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

const CAPS = ["sms", "mms", "rcs", "voice"] as const;

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
  campaignId: "__none__",
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
  const { toast } = useToast();
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
    campaignId: state.campaignId === "__none__" ? undefined : state.campaignId,
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
        tone: "success",
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
          tone: "danger",
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
      toast({ title: `${res.numbers.length} numbers available`, tone: "info" });
    });
  }

  function submitProvision(draft: boolean) {
    if (validationIssues.length > 0) {
      toast({
        title: "Cannot provision",
        description: validationIssues.map((i) => i.message).join("; "),
        tone: "danger",
      });
      return;
    }
    if (complianceMissing) {
      toast({
        title: "Compliance missing",
        description: `${compliance.key?.toUpperCase()} registration is required before provisioning in ${state.country}.`,
        tone: "danger",
      });
      return;
    }
    startProvision(async () => {
      const res = await provisionNumbers({ ...provisionInput, draft });
      if (!res.ok) {
        toast({
          title: "Provisioning failed",
          description: res.error,
          tone: "danger",
        });
        return;
      }
      toast({
        title: draft
          ? "Draft saved for admin approval"
          : `Provisioned ${res.ids.length} number${res.ids.length === 1 ? "" : "s"}`,
        tone: "success",
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
            tone: "danger",
          });
        } else {
          toast({ title: "Test call queued (stub)", tone: "info" });
        }
      }
      router.push("/sabsms/numbers");
    });
  }

  const recommended = getRecommendedProvider(state.country);
  const recommendedLabel = providers.find((p) => p.id === recommended.provider)?.label;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Step 1 - Provider */}
      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
          <CardDescription>
            Phase 1 ships with Twilio only. Other carriers light up in
            Phase 7.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <RadioGroup
              value={state.provider}
              onValueChange={(v) => patch({ provider: v as SabsmsProviderId })}
              aria-label="Provider"
              className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
            >
              {providers.map((p) => (
                <label
                  key={p.id}
                  className={[
                    "flex flex-col gap-1 rounded-[var(--st-radius)] border px-3 py-3 text-sm transition-colors",
                    p.available
                      ? "cursor-pointer border-[var(--st-border)] bg-[var(--st-bg)] hover:border-[var(--st-accent)]"
                      : "cursor-not-allowed border-[var(--st-border)] bg-[var(--st-bg-secondary)] opacity-60",
                    state.provider === p.id ? "border-[var(--st-accent)]" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Radio
                    value={p.id}
                    disabled={!p.available}
                    label={
                      <span className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                        {p.label}
                        {!p.available && (
                          <Badge variant="secondary">Phase 7</Badge>
                        )}
                      </span>
                    }
                  />
                  <span className="pl-6 text-xs text-[var(--st-text-secondary)]">
                    {p.available
                      ? "Available now."
                      : "Routing + provisioning ships in Phase 7."}
                  </span>
                </label>
              ))}
            </RadioGroup>
            <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text)]">
              <strong className="font-semibold">Auto-suggest: </strong>
              {recommended.reason} (Recommended: {recommendedLabel})
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Step 2 - Country + Type + Capabilities + Pattern */}
      <Card>
        <CardHeader>
          <CardTitle>Region and shape</CardTitle>
          <CardDescription>
            Country drives the cost band and the compliance check.
            Capabilities filter the search.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Country" id="country">
              <Select
                value={state.country}
                onValueChange={(v) => patch({ country: v })}
              >
                <SelectTrigger id="country">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Area code / pattern" id="pattern">
              <Input
                id="pattern"
                value={state.pattern}
                onChange={(e) => patch({ pattern: e.target.value })}
                placeholder="e.g. 415 or 1888"
                iconLeft={Search}
              />
            </Field>
          </div>

          <RadioGroup
            value={state.type}
            onValueChange={(v) => patch({ type: v as SabsmsNumberType })}
            aria-label="Number type"
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
          >
            {TYPE_OPTIONS.map((t) => (
              <label
                key={t.value}
                className={[
                  "flex cursor-pointer flex-col gap-1 rounded-[var(--st-radius)] border px-3 py-3 text-sm transition-colors hover:border-[var(--st-accent)]",
                  state.type === t.value
                    ? "border-[var(--st-accent)] bg-[var(--st-bg)]"
                    : "border-[var(--st-border)] bg-[var(--st-bg)]",
                ].join(" ")}
              >
                <Radio
                  value={t.value}
                  label={
                    <span className="font-medium text-[var(--st-text)]">
                      {t.label}
                    </span>
                  }
                />
                <span className="pl-6 text-xs text-[var(--st-text-secondary)]">
                  {t.description}
                </span>
              </label>
            ))}
          </RadioGroup>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {CAPS.map((cap) => (
              <label
                key={cap}
                className="flex cursor-pointer items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm text-[var(--st-text)]"
              >
                <Checkbox
                  checked={state.capabilities[cap]}
                  onChange={() => toggleCapability(cap)}
                  aria-label={`${cap} capability`}
                />
                <span className="uppercase tracking-wide">{cap}</span>
              </label>
            ))}
          </div>

          {state.type === "alphanumeric" && (
            <Field
              label="Default sender ID (alpha)"
              id="senderId"
              help="One-way only. Max 11 chars. Country support varies."
            >
              <Input
                id="senderId"
                value={state.defaultSenderId}
                onChange={(e) => patch({ defaultSenderId: e.target.value })}
                placeholder="e.g. SABSMS"
                maxLength={11}
              />
            </Field>
          )}
        </CardBody>
      </Card>

      {/* Compliance pre-check */}
      {compliance.required && (
        <Alert
          tone={complianceMissing ? "danger" : "success"}
          icon={complianceMissing ? AlertTriangle : ShieldCheck}
        >
          <AlertTitle>
            {compliance.key === "10dlc"
              ? "10DLC brand and campaign"
              : "Indian DLT registration"}{" "}
            {complianceMissing ? "missing" : "ready"}
          </AlertTitle>
          <AlertDescription>
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
                  className="w-fit"
                >
                  Start Registration
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Step 3 - Search results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Available numbers</CardTitle>
            <CardDescription>
              Phase 1 mock - the engine does not expose
              /v1/numbers/search yet. Results are deterministic per
              country + pattern.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={runSearch}
              loading={searchPending}
              iconLeft={searchPending ? undefined : Search}
            >
              Search
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {available.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No results yet"
              description="Pick the shape above and search."
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
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
              <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
                <Table>
                  <THead>
                    <Tr>
                      <Th width={40} aria-label="Select" />
                      <Th>Number</Th>
                      <Th>Country</Th>
                      <Th>Caps</Th>
                      <Th align="right">Monthly cost</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {available.map((n) => {
                      const checked = state.selected.has(n.e164);
                      return (
                        <Tr key={n.e164} selected={checked}>
                          <Td>
                            <Checkbox
                              checked={checked}
                              onChange={() => toggleSelected(n.e164)}
                              aria-label={`Select ${n.e164}`}
                            />
                          </Td>
                          <Td className="font-mono">{n.e164}</Td>
                          <Td className="text-xs">{n.country}</Td>
                          <Td>
                            <div className="flex flex-wrap gap-1">
                              {CAPS.filter((c) => n.capabilities[c]).map((c) => (
                                <Badge
                                  key={c}
                                  variant="secondary"
                                  className="text-[10px] uppercase"
                                >
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          </Td>
                          <Td align="right" className="font-mono text-xs">
                            ${(n.monthlyCost / 100).toFixed(2)}/mo
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Step 4 - Assignment + webhook + footer + test call */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment and defaults</CardTitle>
          <CardDescription>
            Optional - these can be edited later from the number detail
            page.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Assign to campaign" id="campaign">
              <Select
                value={state.campaignId}
                onValueChange={(v) => patch({ campaignId: v })}
              >
                <SelectTrigger id="campaign">
                  <SelectValue placeholder="No campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No campaign</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assign to sender pool" id="pool">
              <Select
                value={state.poolId}
                onValueChange={(v) => patch({ poolId: v })}
              >
                <SelectTrigger id="pool">
                  <SelectValue placeholder="Pool" />
                </SelectTrigger>
                <SelectContent>
                  {pools.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Webhook URL override" id="webhook">
            <Input
              id="webhook"
              value={state.webhookUrlOverride}
              onChange={(e) => patch({ webhookUrlOverride: e.target.value })}
              placeholder="https://... (leave blank to use workspace defaults)"
            />
            <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-xs text-[var(--st-text-secondary)]">
              <div className="font-medium text-[var(--st-text)]">
                Auto-configured webhook preview
              </div>
              <ul className="mt-1 space-y-1 font-mono">
                <li>Inbound - /api/sabsms/webhooks/twilio/inbound</li>
                <li>DLR - /api/sabsms/webhooks/twilio/dlr</li>
                <li>Voice - /api/sabsms/webhooks/twilio/voice (Phase 7)</li>
              </ul>
            </div>
          </Field>

          <Field label="Default footer policy" id="footer">
            <Textarea
              id="footer"
              rows={2}
              value={state.defaultFooter}
              onChange={(e) => patch({ defaultFooter: e.target.value })}
              placeholder="Reply STOP to opt out. Msg&data rates may apply."
            />
          </Field>

          {state.capabilities.voice && (
            <Field
              label="Test call (after provision)"
              id="test-call"
              help="Engine does not support voice yet (Phase 7) - this queues an audit-log entry only."
            >
              <Input
                id="test-call"
                value={state.testCallTarget}
                onChange={(e) => patch({ testCallTarget: e.target.value })}
                placeholder="+15555550100"
              />
            </Field>
          )}
        </CardBody>
      </Card>

      {/* Step 5 - Attestation */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance attestation</CardTitle>
          <CardDescription>
            Required - what is this number going to be used for?
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          <Field label="Primary use case" id="usecase">
            <Select
              value={state.useCase}
              onValueChange={(v) => patch({ useCase: v })}
            >
              <SelectTrigger id="usecase">
                <SelectValue placeholder="Pick a use case" />
              </SelectTrigger>
              <SelectContent>
                {USE_CASES.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {costCap && (
            <Alert tone="danger" icon={AlertTriangle}>
              <AlertTitle>Cost cap warning</AlertTitle>
              <AlertDescription>
                Estimated monthly cost{" "}
                <span className="font-mono">
                  ${(monthlyCostEstimate / 100).toFixed(2)}
                </span>{" "}
                exceeds the $100 cap. Use Save as draft and ask an admin
                to review.
              </AlertDescription>
            </Alert>
          )}

          <Alert tone="info" icon={CheckCircle2}>
            <AlertTitle>Audit log</AlertTitle>
            <AlertDescription>
              Every provision (and every test call) writes an entry to{" "}
              <code className="rounded bg-[var(--st-bg-muted)] px-1">sabsms_audit_log</code>{" "}
              with the workspace, provider, country, type, attested use
              case and the numbers touched.
            </AlertDescription>
          </Alert>
        </CardBody>
      </Card>

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Badge variant="secondary">
            <MapPin className="mr-1 h-3 w-3" aria-hidden="true" />
            {state.country} / {state.type}
          </Badge>
          <Badge variant="secondary">
            {state.selected.size} selected
          </Badge>
          <span className="font-mono text-[var(--st-text)]">
            est. ${(monthlyCostEstimate / 100).toFixed(2)}/mo
          </span>
          {validationIssues.length > 0 && (
            <span className="text-[var(--st-danger)]">
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
            loading={provisionPending}
          >
            Provision {state.selected.size > 0 ? state.selected.size : ""}
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
            <Field label="Business Name" id="compliance-biz-name">
              <Input id="compliance-biz-name" placeholder="Acme Corp" />
            </Field>
            <Field label="Tax ID / Registration Number" id="compliance-tax-id">
              <Input id="compliance-tax-id" placeholder="XX-XXXXXXX" />
            </Field>
            <p className="text-xs text-[var(--st-text-secondary)]">
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
            <Button
              onClick={handleRegisterCompliance}
              disabled={complianceMockLoading}
              loading={complianceMockLoading}
            >
              Submit Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
