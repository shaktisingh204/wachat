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
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Checkbox,
  Input,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Textarea,
} from "@/components/zoruui";
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

  // ─── Debounced live count + sample (features 3 + 4) ─────────────────────

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

  // ─── Save / import / share / version diff / AI / cost ────────────────────

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
      message: `Saved — ${res.size.toLocaleString()} members in segment.`,
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
      {/* ─── Left column: form + canvas ─────────────────────────────── */}
      <div className="space-y-6">
        {banner && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              banner.kind === "ok"
                ? "border-zoru-line bg-zoru-surface-2 text-zoru-ink"
                : "border-zoru-line bg-zoru-surface-2 text-zoru-ink"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div>{banner.message}</div>
                {banner.kind === "err" && banner.issues && banner.issues.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {banner.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => setBanner(null)}
              >
                dismiss
              </button>
            </div>
          </div>
        )}

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Details</ZoruCardTitle>
            <ZoruCardDescription>
              Name, description and category. Marketing segments must include a
              consent gate.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="seg-name">Name</Label>
                <Input
                  id="seg-name"
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  placeholder="e.g. India VIPs"
                />
              </div>
              <div>
                <Label htmlFor="seg-category">Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) =>
                    patchDraft({
                      category:
                        v as SegmentBuilderDraft["category"],
                    })
                  }
                >
                  <ZoruSelectTrigger id="seg-category">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="marketing">Marketing</ZoruSelectItem>
                    <ZoruSelectItem value="transactional">Transactional</ZoruSelectItem>
                    <ZoruSelectItem value="otp">OTP</ZoruSelectItem>
                    <ZoruSelectItem value="alert">Alert</ZoruSelectItem>
                    <ZoruSelectItem value="service">Service</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="seg-desc">Description</Label>
              <Textarea
                id="seg-desc"
                value={draft.description ?? ""}
                onChange={(e) => patchDraft({ description: e.target.value })}
                placeholder="Why does this segment exist?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Mode</Label>
                <RadioGroup
                  value={draft.kind}
                  onValueChange={(v) =>
                    patchDraft({ kind: v as "static" | "dynamic" })
                  }
                  className="flex gap-3"
                >
                  <label className="flex items-center gap-2 rounded-md border border-zoru-line px-3 py-2 text-sm">
                    <ZoruRadioGroupItem value="dynamic" id="kind-dynamic" />
                    <div>
                      <div className="font-medium">Dynamic</div>
                      <div className="text-xs text-zoru-ink">
                        Re-evaluated on read.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-zoru-line px-3 py-2 text-sm">
                    <ZoruRadioGroupItem value="static" id="kind-static" />
                    <div>
                      <div className="font-medium">Static</div>
                      <div className="text-xs text-zoru-ink">
                        Frozen list at save time.
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="seg-cron">
                  Auto re-evaluation (seconds)
                </Label>
                <Input
                  id="seg-cron"
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
              </div>
            </div>
            <div>
              <Label htmlFor="seg-tags">Tags</Label>
              <Input
                id="seg-tags"
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
            </div>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <ZoruCardTitle>Predicate</ZoruCardTitle>
                <ZoruCardDescription>
                  Combine rules with AND / OR groups.
                  {leafCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {leafCount} rule{leafCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {draft.category === "marketing" && (
                    <Badge
                      variant={consentOk ? "default" : "destructive"}
                      className="ml-1 text-[10px]"
                    >
                      {consentOk ? "Consent gate OK" : "Consent gate missing"}
                    </Badge>
                  )}
                </ZoruCardDescription>
              </div>
              {matchedCount !== null && (
                <Badge variant="outline" className="text-zoru-ink bg-zoru-surface-2 border-zoru-line">
                  <Calculator className="mr-1 h-3 w-3" />
                  ~{matchedCount.toLocaleString()} matching
                </Badge>
              )}
            </div>
          </ZoruCardHeader>
          <ZoruCardContent>
            <PredicateCanvas
              predicate={draft.predicate}
              onChange={(p) => patchDraft({ predicate: p })}
            />
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>SQL-style preview</ZoruCardTitle>
            <ZoruCardDescription>
              Read-only translation of the predicate AST.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <pre className="overflow-auto rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-xs">
              <code>{`SELECT * FROM contacts WHERE\n  ${sql}`}</code>
            </pre>
          </ZoruCardContent>
        </Card>

        {draft.category === "marketing" && (
          <Card className="border-zoru-line bg-zoru-surface-2">
            <ZoruCardHeader>
              <ZoruCardTitle className="text-zoru-ink">
                Marketing attestation
              </ZoruCardTitle>
              <ZoruCardDescription>
                Required for marketing segments. By checking this box you
                confirm every contact in this segment has given consent to
                receive promotional messages.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={draft.attestation}
                  onCheckedChange={(c) =>
                    patchDraft({ attestation: c === true })
                  }
                />
                <span>
                  I confirm every recipient in this segment has opted in to
                  marketing messages.
                </span>
              </label>
            </ZoruCardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2 sticky bottom-0 rounded-md border border-zoru-line bg-white p-3 shadow-sm">
          <Button onClick={handleSave} disabled={busy === "save"}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {busy === "save" ? "Saving…" : "Save segment"}
          </Button>
          <Button variant="outline" onClick={handleCost} disabled={busy === "cost"}>
            <Calculator className="mr-1.5 h-3.5 w-3.5" />
            Forecast cost
          </Button>
          <Button
            variant="outline"
            onClick={() => setAiOpen(true)}
            disabled={aiBusy}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Build from prompt
          </Button>
          <Button
            variant="outline"
            onClick={exportPredicateJson}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export JSON
          </Button>
          <Button variant="outline" onClick={handleShare} disabled={!savedId || busy === "share"}>
            <Share2 className="mr-1.5 h-3.5 w-3.5" />
            Share
          </Button>
          <Button variant="outline" onClick={handleVersions} disabled={!savedId}>
            <GitCompare className="mr-1.5 h-3.5 w-3.5" />
            Diff versions
          </Button>
          {savedId && (
            <Button asChild variant="ghost">
              <Link href={`/sabsms/drips/new?segmentId=${savedId}`}>
                Convert to drip trigger
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Right column: live preview, import, test ──────────────── */}
      <aside className="space-y-4">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Live preview</ZoruCardTitle>
            <ZoruCardDescription>
              {previewBusy
                ? "Evaluating…"
                : matchedCount !== null
                  ? `Matches ${matchedCount.toLocaleString()} of ${scannedCount?.toLocaleString() ?? "?"} contacts.`
                  : "Add a rule to see matches."}
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {sample.length === 0 ? (
              <p className="text-xs text-zoru-ink">
                No matching contacts yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {sample.map((c) => (
                  <li
                    key={c.id || c.phone}
                    className="flex items-center justify-between rounded-md border border-zoru-line px-2 py-1.5 text-sm"
                  >
                    <span className="font-mono text-xs">{c.phone}</span>
                    <span className="text-[11px] text-zoru-ink">
                      {c.country ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Import predicate</ZoruCardTitle>
            <ZoruCardDescription>
              Copy the rule tree from an existing segment.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-2">
            {importableSegments.length === 0 ? (
              <p className="text-xs text-zoru-ink">
                No saved segments to import from yet.
              </p>
            ) : (
              <Select onValueChange={(v) => handleImport(v)}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Pick a segment…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {importableSegments.map((s) => (
                    <ZoruSelectItem key={s.id} value={s.id}>
                      {s.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            )}
            <p className="text-[11px] text-zoru-ink">
              <Import className="mr-1 inline h-3 w-3" />
              Imports replace the current predicate.
            </p>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Test against a phone</ZoruCardTitle>
            <ZoruCardDescription>
              Check whether a specific number matches the predicate.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+1 415…"
              />
              <Button
                onClick={handleTestPhone}
                disabled={busy === "test" || !testPhone.trim()}
              >
                <Phone className="mr-1 h-3.5 w-3.5" />
                Test
              </Button>
            </div>
            {testResult && (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  testResult.matched
                    ? "border-zoru-line bg-zoru-surface-2 text-zoru-ink"
                    : "border-zoru-line bg-zoru-surface-2 text-zoru-ink"
                }`}
              >
                {testResult.matched
                  ? "Matches the predicate."
                  : "Does not match the predicate."}
                {!testResult.contactFound && (
                  <span className="ml-1 text-zoru-ink">
                    (no contact in your DB — evaluated against the phone only)
                  </span>
                )}
              </div>
            )}
          </ZoruCardContent>
        </Card>

        {forecast && (
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Forecast</ZoruCardTitle>
              <ZoruCardDescription>
                Estimated cost to send 1 SMS to every member.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-2 text-sm">
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
            </ZoruCardContent>
          </Card>
        )}

        {shareToken && (
          <Card className="border-zoru-line bg-zoru-surface-2">
            <ZoruCardHeader>
              <ZoruCardTitle className="text-zoru-ink text-sm">
                Share link
              </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <code className="block break-all rounded bg-white px-2 py-1 text-[11px]">
                /sabsms/segments/share/{shareToken}
              </code>
            </ZoruCardContent>
          </Card>
        )}
      </aside>

      {/* AI Build modal */}
      <SabsmsDetailDrawer
        open={aiOpen}
        onOpenChange={setAiOpen}
        title="Build segment from prompt"
        description="Describe the audience in plain English — the AI returns a predicate you can edit."
      >
        <div className="space-y-3">
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g. People in the US who clicked in the last 30 days and aren't unsubscribed"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAiOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAi} disabled={aiBusy || !aiPrompt.trim()}>
              <Bot className="mr-1 h-3.5 w-3.5" />
              {aiBusy ? "Thinking…" : "Generate"}
            </Button>
          </div>
          <p className="text-[11px] text-zoru-ink">
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
              <pre className="overflow-auto rounded border border-zoru-line bg-zoru-surface-2 p-2">
                {JSON.stringify(versionsState.current, null, 2)}
              </pre>
            </div>
            {versionsState.versions.length === 0 ? (
              <p className="text-zoru-ink">
                No prior versions yet. Every save records a snapshot here.
              </p>
            ) : (
              versionsState.versions
                .slice()
                .reverse()
                .map((v, i) => (
                  <div key={i}>
                    <div className="mb-1 font-semibold">
                      {new Date(v.at).toLocaleString()} — {v.note ?? "save"}
                    </div>
                    <pre className="overflow-auto rounded border border-zoru-line bg-zoru-surface-2 p-2">
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
