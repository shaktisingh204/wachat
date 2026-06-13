"use client";

/**
 * SabSMS consent log - interactive client surface.
 *
 * Renders the filter bar, data table, timeline drawer, jurisdiction
 * badge row, cohort retention chart, DSR + erasure dialogs, retroactive
 * import flow, and tag / taxonomy editors.
 */

import * as React from "react";
import {
  Activity,
  BadgeCheck,
  Eraser,
  History,
  ListPlus,
  Mail,
  ShieldCheck,
  Tag as TagIcon,
  Webhook,
} from "lucide-react";

import { SabFilePicker } from "@/components/sabfiles";
import {
  SabsmsColumn,
  SabsmsDataTable,
  SabsmsDetailDrawer,
  SabsmsExportMenu,
  SabsmsFilterBar,
  SabsmsRefreshButton,
  SabsmsSavedViews,
  rowsToCsv,
} from "@/components/sabsms/page-toolkit";
import {
  CHART_PALETTE,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Recharts,
  ChartContainer,
  ChartTooltip,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@/components/sabcrm/20ui";

import {
  type CohortPoint,
  type ConsentRow,
  type JurisdictionStatus,
  addConsentReasonTaxonomy,
  bulkImportRetroactiveConsents,
  erasureRequest,
  exportAuditTrailPdf,
  loadTimeline,
  reRequestConsent,
  removeConsentReasonTaxonomy,
  signExportPayload,
  subjectAccessRequest,
  tagConsentEvent,
  verifyDoubleOptInForPhone,
} from "./actions";

const KIND_OPTIONS = [
  { value: "opt_in_single", label: "Opt-in (single)" },
  { value: "opt_in_double", label: "Opt-in (double)" },
  { value: "opt_in_restart", label: "Opt-in (restart)" },
  { value: "opt_out_stop", label: "Opt-out (STOP)" },
  { value: "opt_out_manual", label: "Opt-out (manual)" },
  { value: "opt_out_complaint", label: "Opt-out (complaint)" },
  { value: "opt_out_carrier_block", label: "Opt-out (carrier)" },
];

const CAPTURE_METHOD_OPTIONS = [
  { value: "web_form", label: "Web form" },
  { value: "api", label: "API" },
  { value: "import", label: "Import" },
  { value: "verbal", label: "Verbal" },
  { value: "inbound_keyword", label: "Inbound keyword" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

export interface ConsentTableProps {
  rows: ConsentRow[];
  total: number;
  page: number;
  pageSize: number;
  jurisdictions: JurisdictionStatus[];
  cohort: CohortPoint[];
  reasonTaxonomy: string[];
  isAdmin: boolean;
}

export function ConsentTable({
  rows,
  total,
  page,
  pageSize,
  jurisdictions,
  cohort,
  reasonTaxonomy,
  isAdmin,
}: ConsentTableProps) {
  const [timelineFor, setTimelineFor] = React.useState<ConsentRow | null>(null);
  const [timelineRows, setTimelineRows] = React.useState<ConsentRow[]>([]);
  const [timelineLoading, setTimelineLoading] = React.useState(false);
  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [verifyHash, setVerifyHash] = React.useState("");
  const [verifyResult, setVerifyResult] = React.useState<{
    verified: boolean;
    verifiedAt?: string;
  } | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importKind, setImportKind] = React.useState<ConsentRow["kind"]>(
    "opt_in_double",
  );
  const [importCapture, setImportCapture] = React.useState<
    ConsentRow["captureMethod"]
  >("import");
  const [tagRow, setTagRow] = React.useState<ConsentRow | null>(null);
  const [tagValue, setTagValue] = React.useState("");
  const [dsrOpen, setDsrOpen] = React.useState(false);
  const [dsrHash, setDsrHash] = React.useState("");
  const [dsrPayload, setDsrPayload] = React.useState<string | null>(null);
  const [erasureOpen, setErasureOpen] = React.useState(false);
  const [erasureHash, setErasureHash] = React.useState("");
  const [taxonomyOpen, setTaxonomyOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  const columns: SabsmsColumn<ConsentRow>[] = React.useMemo(
    () => [
      {
        id: "phoneHash",
        header: "Phone hash",
        render: (r) => (
          <Button
            variant="ghost"
            size="sm"
            className="font-mono text-xs"
            onClick={() => openTimeline(r)}
          >
            {r.phoneHash.slice(0, 12)}...{r.phoneHash.slice(-4)}
          </Button>
        ),
        width: "200px",
      },
      {
        id: "kind",
        header: "Kind",
        render: (r) => (
          <Badge
            variant={r.kind.startsWith("opt_in") ? "default" : "destructive"}
          >
            {r.kind.replace(/_/g, " ")}
          </Badge>
        ),
        width: "170px",
      },
      {
        id: "captureMethod",
        header: "Capture",
        render: (r) => (
          <span className="text-xs text-[var(--st-text)]">{r.captureMethod}</span>
        ),
        width: "120px",
      },
      {
        id: "source",
        header: "Source URL",
        render: (r) =>
          r.source ? (
            <span className="truncate text-xs text-[var(--st-text)]">{r.source}</span>
          ) : (
            <span className="text-xs text-[var(--st-text-secondary)]">-</span>
          ),
      },
      {
        id: "ip",
        header: "IP",
        render: (r) => (
          <span className="font-mono text-xs text-[var(--st-text)]">
            {r.ip ?? "-"}
          </span>
        ),
        width: "120px",
      },
      {
        id: "userAgent",
        header: "User agent",
        render: (r) =>
          r.userAgent ? (
            <span
              className="truncate text-xs text-[var(--st-text)]"
              title={r.userAgent}
            >
              {r.userAgent.slice(0, 36)}
              {r.userAgent.length > 36 ? "..." : ""}
            </span>
          ) : (
            <span className="text-xs text-[var(--st-text-secondary)]">-</span>
          ),
        width: "200px",
        hideByDefault: true,
      },
      {
        id: "createdAt",
        header: "When",
        render: (r) =>
          new Date(r.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        width: "170px",
      },
    ],
    [],
  );

  async function openTimeline(row: ConsentRow) {
    setTimelineFor(row);
    setTimelineLoading(true);
    try {
      const t = await loadTimeline("", row.phoneHash);
      setTimelineRows(t);
    } finally {
      setTimelineLoading(false);
    }
  }

  async function runVerify() {
    if (!verifyHash.trim()) return;
    setBusy("Verifying...");
    try {
      const res = await verifyDoubleOptInForPhone({
        phoneHash: verifyHash.trim(),
      });
      setVerifyResult(res);
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveTag() {
    if (!tagRow) return;
    setBusy("Saving tag...");
    try {
      const res = await tagConsentEvent({ id: tagRow.id, tag: tagValue });
      if (res.ok) {
        setTagRow(null);
        refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function runDsr() {
    if (!dsrHash.trim()) return;
    setBusy("Building DSR payload...");
    try {
      const res = await subjectAccessRequest({ phoneHash: dsrHash.trim() });
      if (res.ok) {
        setDsrPayload(res.payload);
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function runErasure() {
    if (!erasureHash.trim()) return;
    setBusy("Running erasure...");
    try {
      const res = await erasureRequest({ phoneHash: erasureHash.trim() });
      if (res.ok) {
        setErasureOpen(false);
        setErasureHash("");
        refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  const exportCsv = React.useCallback(async () => {
    const csv = rowsToCsv(rows as unknown as Array<Record<string, unknown>>, [
      { key: "phoneHash", header: "phone_hash" },
      { key: "kind", header: "kind" },
      { key: "captureMethod", header: "capture_method" },
      { key: "source", header: "source" },
      { key: "ip", header: "ip" },
      { key: "userAgent", header: "user_agent" },
      { key: "createdAt", header: "created_at" },
    ]);
    const signature = await signExportPayload(csv);
    return `${csv}\n# signature-sha256: ${signature}\n# rows: ${rows.length}\n# generated_at: ${new Date().toISOString()}`;
  }, [rows]);

  const exportJson = React.useCallback(async () => {
    const lines = rows.map((r) => JSON.stringify(r));
    const body = lines.join("\n");
    const signature = await signExportPayload(body);
    return `${body}\n${JSON.stringify({ signature_sha256: signature, generated_at: new Date().toISOString(), rows: rows.length })}`;
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Jurisdiction badge row */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Compliance status</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {jurisdictions.map((j) => (
            <span
              key={j.code}
              className="flex items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] px-2.5 py-1 text-xs"
              title={j.note}
            >
              <Badge
                variant={
                  j.status === "ok"
                    ? "default"
                    : j.status === "warn"
                      ? "secondary"
                      : "destructive"
                }
              >
                {j.code}
              </Badge>
              <span className="text-[var(--st-text)]">{j.note}</span>
            </span>
          ))}
        </CardBody>
      </Card>

      {/* Cohort retention */}
      {cohort.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Consent stickiness (last 12 cohorts)
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ChartContainer
              className="h-[180px]"
              config={{
                totalOptIn: { label: "Opt-ins", color: CHART_PALETTE[0] },
                retained: { label: "Retained", color: CHART_PALETTE[1] },
              }}
            >
              <Recharts.BarChart data={cohort} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <Recharts.CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-[var(--st-border)]"
                />
                <Recharts.XAxis
                  dataKey="bucket"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Recharts.YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Bar
                  dataKey="totalOptIn"
                  fill={CHART_PALETTE[0]}
                  radius={[2, 2, 0, 0]}
                />
                <Recharts.Bar
                  dataKey="retained"
                  fill={CHART_PALETTE[1]}
                  radius={[2, 2, 0, 0]}
                />
              </Recharts.BarChart>
            </ChartContainer>
          </CardBody>
        </Card>
      )}

      <SabsmsFilterBar
        searchPlaceholder="Phone hash (64-char hex) or prefix"
        facets={[
          { key: "kind", label: "Kind", options: KIND_OPTIONS, multi: true },
          {
            key: "captureMethod",
            label: "Capture",
            options: CAPTURE_METHOD_OPTIONS,
            multi: true,
          },
        ]}
        sortOptions={SORT_OPTIONS}
        defaultSort="newest"
        dateRangeKey={{ from: "from", to: "to" }}
        trailing={
          <>
            <SabsmsSavedViews scope="consent" />
            <SabsmsRefreshButton onRefresh={refresh} />
            <Button
              variant="outline"
              size="sm"
              iconLeft={BadgeCheck}
              onClick={() => setVerifyOpen(true)}
            >
              Verify double opt-in
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={ListPlus}
              onClick={() => setImportOpen(true)}
            >
              Import
            </Button>
            <SabsmsExportMenu
              filename={`sabsms-consent-${Date.now()}`}
              toCsv={exportCsv}
              toJson={exportJson}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const r = await exportAuditTrailPdf();
                if (r.ok) {
                  toast.success("Audit PDF exported");
                } else {
                  toast.error(r.error);
                }
              }}
            >
              Audit PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={ShieldCheck}
              onClick={() => setDsrOpen(true)}
            >
              DSR
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={Eraser}
              onClick={() => setErasureOpen(true)}
            >
              Erasure
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={TagIcon}
              onClick={() => setTaxonomyOpen(true)}
            >
              Reasons
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconLeft={Webhook}
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/sabsms/webhooks";
                }
              }}
            >
              Webhook
            </Button>
          </>
        }
      />

      <SabsmsDataTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        columns={columns}
        rowKey={(r) => r.id}
        rowActions={[
          {
            label: "Open timeline",
            icon: <History className="h-3.5 w-3.5" aria-hidden="true" />,
            onSelect: (r) => openTimeline(r),
          },
          {
            label: "Tag",
            icon: <TagIcon className="h-3.5 w-3.5" aria-hidden="true" />,
            onSelect: (r) => {
              setTagRow(r);
              setTagValue(
                (r.metadata as { tag?: string } | undefined)?.tag ?? "",
              );
            },
          },
          {
            label: "Re-request consent",
            icon: <Mail className="h-3.5 w-3.5" aria-hidden="true" />,
            onSelect: async (r) => {
              const res = await reRequestConsent({ phoneHash: r.phoneHash });
              if (res.ok) {
                toast.success("Sent");
              } else {
                toast.error(res.error);
              }
            },
          },
        ]}
        emptyTitle="No consent events"
        emptyDescription="Opt-in / opt-out events from web forms, the API, or inbound STOP / START keywords appear here."
      />

      {/* Timeline drawer */}
      <SabsmsDetailDrawer
        open={!!timelineFor}
        onOpenChange={(o) => !o && setTimelineFor(null)}
        title="Consent timeline"
        description={
          timelineFor
            ? `Phone hash ${timelineFor.phoneHash.slice(0, 12)}...`
            : undefined
        }
      >
        {timelineLoading ? (
          <p className="text-sm text-[var(--st-text)]">Loading...</p>
        ) : timelineRows.length === 0 ? (
          <p className="text-sm text-[var(--st-text)]">No events for this hash.</p>
        ) : (
          <ol className="space-y-3">
            {timelineRows.map((e) => (
              <li
                key={e.id}
                className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      e.kind.startsWith("opt_in") ? "default" : "destructive"
                    }
                  >
                    {e.kind}
                  </Badge>
                  <span className="text-[var(--st-text)]">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1.5 text-[var(--st-text)]">
                  via {e.captureMethod}
                  {e.source && `, ${e.source}`}
                </p>
                {e.ip && <p className="text-[var(--st-text)]">ip {e.ip}</p>}
              </li>
            ))}
          </ol>
        )}
      </SabsmsDetailDrawer>

      {/* Verify double-opt-in dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify double opt-in</DialogTitle>
            <DialogDescription>
              Checks the event timeline for an opt-in-single then opt-in-double
              sequence without an intervening opt-out.
            </DialogDescription>
          </DialogHeader>
          <Field label="Phone hash">
            <Input
              value={verifyHash}
              onChange={(e) => setVerifyHash(e.target.value)}
              placeholder="64-char phone hash"
            />
          </Field>
          {verifyResult && (
            <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
              {verifyResult.verified
                ? `Verified at ${verifyResult.verifiedAt}`
                : "Not double-opt-in verified"}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>
              Close
            </Button>
            <Button onClick={runVerify} disabled={!verifyHash.trim() || !!busy}>
              {busy ?? "Verify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retroactive import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import retroactive consents</DialogTitle>
            <DialogDescription>
              CSV must have <code>phone_hash</code> plus optional{" "}
              <code>source</code> / <code>ip</code> / <code>user_agent</code> /
              <code>captured_at</code> columns.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kind">
              <Select
                value={importKind}
                onValueChange={(v) => setImportKind(v as ConsentRow["kind"])}
              >
                <SelectTrigger aria-label="Kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Capture method">
              <Select
                value={importCapture}
                onValueChange={(v) =>
                  setImportCapture(v as ConsentRow["captureMethod"])
                }
              >
                <SelectTrigger aria-label="Capture method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAPTURE_METHOD_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // The SabFilePicker is rendered separately - opening the
                // file picker requires its own state, so we close the
                // outer dialog first then open the picker.
                setImportOpen(false);
                setTimeout(() => setPickerOpen(true), 50);
              }}
            >
              Pick CSV from SabFiles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConsentImportPicker
        kind={importKind}
        captureMethod={importCapture}
        onComplete={refresh}
      />

      {/* Tag */}
      <Dialog open={!!tagRow} onOpenChange={(o) => !o && setTagRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag consent event</DialogTitle>
            <DialogDescription>
              Useful for grouping events by campaign or audit batch.
            </DialogDescription>
          </DialogHeader>
          <Field label="Tag">
            <Input
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder="e.g. q4-audit"
            />
          </Field>
          {reasonTaxonomy.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {reasonTaxonomy.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setTagValue(t)}
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTag} disabled={!!busy}>
              {busy ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DSR */}
      <Dialog open={dsrOpen} onOpenChange={setDsrOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subject access request</DialogTitle>
            <DialogDescription>
              Returns a JSON dump of every consent event we hold for the given
              phone hash.
            </DialogDescription>
          </DialogHeader>
          <Field label="Phone hash">
            <Input
              value={dsrHash}
              onChange={(e) => setDsrHash(e.target.value)}
              placeholder="64-char phone hash"
            />
          </Field>
          {dsrPayload && (
            <Field label="DSR payload">
              <Textarea
                rows={10}
                value={dsrPayload}
                readOnly
                className="font-mono text-xs"
              />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDsrOpen(false)}>
              Close
            </Button>
            <Button onClick={runDsr} disabled={!dsrHash.trim() || !!busy}>
              {busy ?? "Build payload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Erasure */}
      <Dialog open={erasureOpen} onOpenChange={setErasureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erasure request</DialogTitle>
            <DialogDescription>
              Hash-preserving - clears IP / UA / metadata but keeps the
              hashed row so we still honour the opt-out forever.
            </DialogDescription>
          </DialogHeader>
          <Field label="Phone hash">
            <Input
              value={erasureHash}
              onChange={(e) => setErasureHash(e.target.value)}
              placeholder="64-char phone hash"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErasureOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={runErasure}
              disabled={!erasureHash.trim() || !isAdmin || !!busy}
            >
              {busy ?? (isAdmin ? "Run erasure" : "Admin only")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason taxonomy */}
      <Dialog open={taxonomyOpen} onOpenChange={setTaxonomyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consent reason taxonomy</DialogTitle>
            <DialogDescription>
              Shared labels used for tagging consent events.
            </DialogDescription>
          </DialogHeader>
          <ConsentTaxonomyEditor initial={reasonTaxonomy} refresh={refresh} />
        </DialogContent>
      </Dialog>
    </div>
  );

  // ---------- inner helpers (need closure over state) ---------------------

  function setPickerOpen(_: boolean) {
    // Forward to the keyed picker that lives below.
    pickerCtl.current?.(true);
  }

  // -- tied below --
}

// We keep the import-picker logic in a small component so the SabFiles
// modal isn't unmounted/remounted with the outer dialog tree.
const pickerCtl: { current: ((open: boolean) => void) | null } = {
  current: null,
};

function ConsentImportPicker({
  kind,
  captureMethod,
  onComplete,
}: {
  kind: ConsentRow["kind"];
  captureMethod: ConsentRow["captureMethod"];
  onComplete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    pickerCtl.current = setOpen;
    return () => {
      pickerCtl.current = null;
    };
  }, []);

  return (
    <SabFilePicker
      open={open}
      onOpenChange={setOpen}
      accept="document"
      title="Pick a consent CSV from SabFiles"
      onPick={async (p) => {
        if (!p.url) return;
        const res = await bulkImportRetroactiveConsents({
          sabFileUrl: p.url,
          kind,
          captureMethod,
        });
        if (res.ok) {
          onComplete();
        } else {
          toast.error(res.error);
        }
      }}
    />
  );
}

function ConsentTaxonomyEditor({
  initial,
  refresh,
}: {
  initial: string[];
  refresh: () => void;
}) {
  const [labels, setLabels] = React.useState<string[]>(initial);
  const [draft, setDraft] = React.useState("");

  async function add() {
    if (!draft.trim()) return;
    const res = await addConsentReasonTaxonomy({ label: draft });
    if (res.ok) {
      setLabels((p) => Array.from(new Set([...p, draft.trim()])));
      setDraft("");
      refresh();
    } else {
      toast.error(res.error);
    }
  }
  async function remove(l: string) {
    const res = await removeConsentReasonTaxonomy({ label: l });
    if (res.ok) {
      setLabels((p) => p.filter((x) => x !== l));
      refresh();
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {labels.map((l) => (
          <li
            key={l}
            className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-1.5 text-sm"
          >
            <span>{l}</span>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Activity}
              onClick={() => remove(l)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Field label="New reason label" className="flex-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New reason label"
          />
        </Field>
        <Button onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
