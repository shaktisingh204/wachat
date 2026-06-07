"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Calculator,
  Download,
  GitCompare,
  Import,
  Phone,
  Save,
  Share2,
  Sparkles,
} from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from "@/components/sabcrm/20ui";
import { SabsmsDetailDrawer } from "@/components/sabsms/page-toolkit";

import {
  aiBuildFromPrompt,
  forecastCost,
  loadPriorVersions,
  loadSegmentPredicate,
  mintShareToken,
  previewCount,
  previewSample,
  saveSegment,
  testPredicateAgainstPhone,
  type SegmentBuilderDraft,
  type SampleContact,
} from "./actions";
import {
  countLeaves,
  emptyGroup,
  hasConsentGate,
  predicateToSql,
  type SegmentNode,
} from "./evaluate";
import { PredicateCanvas } from "./predicate-canvas";

interface BuilderProps {
  workspaceId: string;
  initialDraft?: SegmentBuilderDraft;
  initialId?: string;
  importableSegments: { id: string; name: string }[];
}

const DEFAULT_DRAFT: SegmentBuilderDraft = {
  name: "",
  description: "",
  predicate: emptyGroup("and"),
  category: "marketing",
  kind: "dynamic",
  autoRefreshSeconds: undefined,
  tags: [],
  attestation: false,
};

const DEBOUNCE_MS = 500;

interface PriorVersionsState {
  versions: Array<{ at: string; predicate: SegmentNode | null; note?: string }>;
  current: SegmentNode | null;
}

export function SegmentBuilder({
  initialDraft,
  initialId,
  importableSegments,
}: BuilderProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<SegmentBuilderDraft>(
    initialDraft ?? { ...DEFAULT_DRAFT, id: initialId },
  );
  const [savedId, setSavedId] = React.useState<string | undefined>(
    initialDraft?.id ?? initialId,
  );

  // Live count + sample preview state.
  const [matchedCount, setMatchedCount] = React.useState<number | null>(null);
  const [scannedCount, setScannedCount] = React.useState<number | null>(null);
  const [sample, setSample] = React.useState<SampleContact[]>([]);
  const [previewBusy, setPreviewBusy] = React.useState(false);

  // Modals / drawers.
  const [testPhone, setTestPhone] = React.useState("");
  const [testResult, setTestResult] = React.useState<
    | null
    | { matched: boolean; contactFound: boolean; contact?: SampleContact }
  >(null);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [versionsState, setVersionsState] = React.useState<PriorVersionsState | null>(null);
  const [shareToken, setShareToken] = React.useState<string | null>(null);

  // Forecast
  const [forecast, setForecast] = React.useState<{
    size: number;
    pricePerMessageCents: number;
    totalCents: number;
  } | null>(null);

  // Action status
  const [busy, setBusy] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<
    | { kind: "ok"; message: string }
    | { kind: "err"; message: string; issues?: string[] }
    | null
  >(null);

  function patchDraft(patch: Partial<SegmentBuilderDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  // --- Debounced live count + sample (features 3 + 4) ---------------------

  React.useEffect(() => {
    const handle = setTimeout(async () => {
      setPreviewBusy(true);
      const [countRes, sampleRes] = await Promise.all([
        previewCount(draft.predicate),
        previewSample(draft.predicate, 10),
      ]);
      setPreviewBusy(false);
      if (countRes.ok) {
        setMatchedCount(countRes.matched);
        setScannedCount(countRes.scanned);
      }
      if (sampleRes.ok) {
        setSample(sampleRes.rows);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [draft.predicate]);

  // --- Save / import / share / version diff / AI / cost --------------------

  async function handleSave() {
    setBusy("save");
    const res = await saveSegment(draft);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error, issues: res.issues });
      return;
    }
    setSavedId(res.id);
    setBanner({
      kind: "ok",
      message: `Saved. ${res.size.toLocaleString()} members in segment.`,
    });
    // Update the URL so reload returns to this segment.
    router.replace(`/sabsms/segments/new?id=${res.id}`);
  }

  async function handleImport(segmentId: string) {
    setBusy("import");
    const res = await loadSegmentPredicate(segmentId);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    patchDraft({ predicate: res.predicate });
    setBanner({
      kind: "ok",
      message: `Imported predicate from "${res.name}".`,
    });
  }

  async function handleAi() {
    setAiBusy(true);
    const res = await aiBuildFromPrompt(aiPrompt);
    setAiBusy(false);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    patchDraft({ predicate: res.predicate });
    setBanner({ kind: "ok", message: res.note });
    setAiOpen(false);
  }

  async function handleShare() {
    if (!savedId) {
      setBanner({
        kind: "err",
        message: "Save the segment before minting a share token.",
      });
      return;
    }
    setBusy("share");
    const res = await mintShareToken(savedId);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    setShareToken(res.token);
  }

  async function handleVersions() {
    if (!savedId) {
      setBanner({
        kind: "err",
        message: "Save the segment to see its version history.",
      });
      return;
    }
    setBusy("versions");
    const res = await loadPriorVersions(savedId);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    setVersionsState({ versions: res.versions, current: res.current });
  }

  async function handleCost() {
    setBusy("cost");
    const res = await forecastCost(draft.predicate);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    setForecast({
      size: res.size,
      pricePerMessageCents: res.pricePerMessageCents,
      totalCents: res.totalCents,
    });
  }

  async function handleTestPhone() {
    setBusy("test");
    const res = await testPredicateAgainstPhone(draft.predicate, testPhone);
    setBusy(null);
    if (!res.ok) {
      setBanner({ kind: "err", message: res.error });
      return;
    }
    setTestResult({
      matched: res.matched,
      contactFound: res.contactFound,
      contact: res.contact,
    });
  }

  function exportPredicateJson() {
    const blob = new Blob([JSON.stringify(draft.predicate ?? null, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segment-predicate-${draft.name || "untitled"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const sql = React.useMemo(() => predicateToSql(draft.predicate), [draft.predicate]);
  const leafCount = React.useMemo(() => countLeaves(draft.predicate), [draft.predicate]);
  const consentOk = React.useMemo(
    () => hasConsentGate(draft.predicate),
    [draft.predicate],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* --- Left column: form + canvas --------------------------------- */}
      <div className="space-y-6">
        {banner && (
          <Alert
            tone={banner.kind === "ok" ? "success" : "danger"}
            onClose={() => setBanner(null)}
            closeLabel="Dismiss notification"
          >
            <div>{banner.message}</div>
            {banner.kind === "err" && banner.issues && banner.issues.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {banner.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Name, description and category. Marketing segments must include a
              consent gate.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  placeholder="e.g. India VIPs"
                />
              </Field>
              <Field label="Category">
                <Select
                  value={draft.category}
                  onValueChange={(v) =>
                    patchDraft({
                      category: v as SegmentBuilderDraft["category"],
                    })
                  }
                >
                  <SelectTrigger aria-label="Category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="transactional">Transactional</SelectItem>
                    <SelectItem value="otp">OTP</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                value={draft.description ?? ""}
                onChange={(e) => patchDraft({ description: e.target.value })}
                placeholder="Why does this segment exist?"
                rows={2}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Mode</Label>
                <RadioGroup
                  value={draft.kind}
                  onValueChange={(v) =>
                    patchDraft({ kind: v as "static" | "dynamic" })
                  }
                  orientation="horizontal"
                  aria-label="Segment mode"
                  className="mt-1.5 flex gap-3"
                >
                  <RadioGroupItem
                    value="dynamic"
                    id="kind-dynamic"
                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2"
                    label={
                      <span className="block">
                        <span className="block font-medium text-[var(--st-text)]">
                          Dynamic
                        </span>
                        <span className="block text-xs text-[var(--st-text-secondary)]">
                          Re-evaluated on read.
                        </span>
                      </span>
                    }
                  />
                  <RadioGroupItem
                    value="static"
                    id="kind-static"
                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2"
                    label={
                      <span className="block">
                        <span className="block font-medium text-[var(--st-text)]">
                          Static
                        </span>
                        <span className="block text-xs text-[var(--st-text-secondary)]">
                          Frozen list at save time.
                        </span>
                      </span>
                    }
                  />
                </RadioGroup>
              </div>
              <Field label="Auto re-evaluation (seconds)">
                <Input
                  type="number"
                  value={
                    draft.autoRefreshSeconds === undefined
                      ? ""
                      : String(draft.autoRefreshSeconds)
                  }
                  onChange={(e) =>
                    patchDraft({
                      autoRefreshSeconds: e.target.value
                        ? Math.max(60, parseInt(e.target.value, 10) || 0)
                        : undefined,
                    })
                  }
                  placeholder="leave blank to skip"
                />
              </Field>
            </div>
            <Field label="Tags">
              <Input
                value={(draft.tags ?? []).join(", ")}
                onChange={(e) =>
                  patchDraft({
                    tags: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="comma-separated"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Predicate</CardTitle>
                <CardDescription>
                  Combine rules with AND / OR groups.
                  {leafCount > 0 && (
                    <Badge tone="neutral" className="ml-2 text-[10px]">
                      {leafCount} rule{leafCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {draft.category === "marketing" && (
                    <Badge
                      tone={consentOk ? "success" : "danger"}
                      className="ml-1 text-[10px]"
                    >
                      {consentOk ? "Consent gate OK" : "Consent gate missing"}
                    </Badge>
                  )}
                </CardDescription>
              </div>
              {matchedCount !== null && (
                <Badge tone="neutral" kind="outline">
                  <Calculator className="mr-1 h-3 w-3" aria-hidden="true" />
                  ~{matchedCount.toLocaleString()} matching
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardBody>
            <PredicateCanvas
              predicate={draft.predicate}
              onChange={(p) => patchDraft({ predicate: p })}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SQL-style preview</CardTitle>
            <CardDescription>
              Read-only translation of the predicate AST.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <pre className="overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-xs">
              <code>{`SELECT * FROM contacts WHERE\n  ${sql}`}</code>
            </pre>
          </CardBody>
        </Card>

        {draft.category === "marketing" && (
          <Card>
            <CardHeader>
              <CardTitle>Marketing attestation</CardTitle>
              <CardDescription>
                Required for marketing segments. By checking this box you
                confirm every contact in this segment has given consent to
                receive promotional messages.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <Checkbox
                checked={draft.attestation}
                onChange={(e) =>
                  patchDraft({ attestation: e.target.checked })
                }
                label="I confirm every recipient in this segment has opted in to marketing messages."
              />
            </CardBody>
          </Card>
        )}

        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 shadow-sm">
          <Button variant="primary" onClick={handleSave} loading={busy === "save"} iconLeft={Save}>
            {busy === "save" ? "Saving..." : "Save segment"}
          </Button>
          <Button variant="outline" onClick={handleCost} loading={busy === "cost"} iconLeft={Calculator}>
            Forecast cost
          </Button>
          <Button
            variant="outline"
            onClick={() => setAiOpen(true)}
            disabled={aiBusy}
            iconLeft={Sparkles}
          >
            Build from prompt
          </Button>
          <Button variant="outline" onClick={exportPredicateJson} iconLeft={Download}>
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={handleShare}
            disabled={!savedId || busy === "share"}
            iconLeft={Share2}
          >
            Share
          </Button>
          <Button variant="outline" onClick={handleVersions} disabled={!savedId} iconLeft={GitCompare}>
            Diff versions
          </Button>
          {savedId && (
            <Button
              variant="ghost"
              onClick={() => router.push(`/sabsms/drips/new?segmentId=${savedId}`)}
            >
              Convert to drip trigger
            </Button>
          )}
        </div>
      </div>

      {/* --- Right column: live preview, import, test ------------------- */}
      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>
              {previewBusy
                ? "Evaluating..."
                : matchedCount !== null
                  ? `Matches ${matchedCount.toLocaleString()} of ${scannedCount?.toLocaleString() ?? "?"} contacts.`
                  : "Add a rule to see matches."}
            </CardDescription>
          </CardHeader>
          <CardBody>
            {sample.length === 0 ? (
              <EmptyState
                title="No matching contacts yet"
                description="Add a rule to the predicate to preview matches."
                size="sm"
              />
            ) : (
              <ul className="space-y-2">
                {sample.map((c) => (
                  <li
                    key={c.id || c.phone}
                    className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] px-2 py-1.5 text-sm"
                  >
                    <span className="font-mono text-xs">{c.phone}</span>
                    <span className="text-[11px] text-[var(--st-text-secondary)]">
                      {c.country ?? "-"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import predicate</CardTitle>
            <CardDescription>
              Copy the rule tree from an existing segment.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-2">
            {importableSegments.length === 0 ? (
              <p className="text-xs text-[var(--st-text-secondary)]">
                No saved segments to import from yet.
              </p>
            ) : (
              <Select onValueChange={(v) => handleImport(v)}>
                <SelectTrigger aria-label="Import predicate from segment">
                  <SelectValue placeholder="Pick a segment..." />
                </SelectTrigger>
                <SelectContent>
                  {importableSegments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-[var(--st-text-secondary)]">
              <Import className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Imports replace the current predicate.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test against a phone</CardTitle>
            <CardDescription>
              Check whether a specific number matches the predicate.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-2">
            <div className="flex gap-2">
              <Field label="Phone number" className="flex-1">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+1 415..."
                />
              </Field>
              <Button
                variant="primary"
                onClick={handleTestPhone}
                loading={busy === "test"}
                disabled={!testPhone.trim()}
                iconLeft={Phone}
                className="self-end"
              >
                Test
              </Button>
            </div>
            {testResult && (
              <Alert tone={testResult.matched ? "success" : "neutral"} icon={null}>
                {testResult.matched
                  ? "Matches the predicate."
                  : "Does not match the predicate."}
                {!testResult.contactFound && (
                  <span className="ml-1 text-[var(--st-text-secondary)]">
                    (no contact in your DB, evaluated against the phone only)
                  </span>
                )}
              </Alert>
            )}
          </CardBody>
        </Card>

        {forecast && (
          <Card>
            <CardHeader>
              <CardTitle>Forecast</CardTitle>
              <CardDescription>
                Estimated cost to send 1 SMS to every member.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Size</span>
                <span className="tabular-nums">{forecast.size.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Per-message</span>
                <span className="tabular-nums">
                  {(forecast.pricePerMessageCents / 100).toFixed(3)} USD
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {(forecast.totalCents / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </span>
              </div>
            </CardBody>
          </Card>
        )}

        {shareToken && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Share link</CardTitle>
            </CardHeader>
            <CardBody>
              <code className="block break-all rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-2 py-1 text-[11px]">
                /sabsms/segments/share/{shareToken}
              </code>
            </CardBody>
          </Card>
        )}
      </aside>

      {/* AI Build modal */}
      <SabsmsDetailDrawer
        open={aiOpen}
        onOpenChange={setAiOpen}
        title="Build segment from prompt"
        description="Describe the audience in plain English. The AI returns a predicate you can edit."
      >
        <div className="space-y-3">
          <Field label="Audience description">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. People in the US who clicked in the last 30 days and aren't unsubscribed"
              rows={4}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAiOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAi}
              loading={aiBusy}
              disabled={!aiPrompt.trim()}
              iconLeft={Bot}
            >
              {aiBusy ? "Thinking..." : "Generate"}
            </Button>
          </div>
          <p className="text-[11px] text-[var(--st-text-secondary)]">
            Stub: returns a placeholder predicate until the SabSMS LLM
            gateway lands.
          </p>
        </div>
      </SabsmsDetailDrawer>

      {/* Version diff drawer */}
      <SabsmsDetailDrawer
        open={!!versionsState}
        onOpenChange={(o) => !o && setVersionsState(null)}
        title="Version history"
        description="The last 5 saved snapshots."
      >
        {versionsState && (
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-1 font-semibold">Current</div>
              <pre className="overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2">
                {JSON.stringify(versionsState.current, null, 2)}
              </pre>
            </div>
            {versionsState.versions.length === 0 ? (
              <p className="text-[var(--st-text-secondary)]">
                No prior versions yet. Every save records a snapshot here.
              </p>
            ) : (
              versionsState.versions
                .slice()
                .reverse()
                .map((v, i) => (
                  <div key={i}>
                    <div className="mb-1 font-semibold">
                      {new Date(v.at).toLocaleString()}, {v.note ?? "save"}
                    </div>
                    <pre className="overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2">
                      {JSON.stringify(v.predicate, null, 2)}
                    </pre>
                  </div>
                ))
            )}
          </div>
        )}
      </SabsmsDetailDrawer>
    </div>
  );
}
