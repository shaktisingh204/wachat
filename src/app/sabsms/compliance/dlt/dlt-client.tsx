"use client";

/**
 * SabSMS V2.8 — DLT registry hub (client).
 *
 * Four registries, all real: Entities / Headers / Templates / PE→TM
 * chain, backed by the server actions in `./actions.ts`. Each registry
 * gets a list table, add/edit modal, delete-with-confirm, and a 3-step
 * CSV import wizard (source → column mapping → preview) built on the
 * pure helpers in `./csv-mapping.ts`.
 */

import * as React from "react";
import {
  Building,
  FileText,
  Hash,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Upload,
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
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@/components/sabcrm/20ui";
import { SabFilePickerButton, type SabFilePick } from "@/components/sabfiles";

import {
  deleteDltChainAction,
  deleteDltEntityAction,
  deleteDltHeaderAction,
  deleteDltTemplateAction,
  importDltCsvAction,
  loadDltRegistryAction,
  saveDltChainAction,
  saveDltEntityAction,
  saveDltHeaderAction,
  saveDltTemplateAction,
} from "./actions";
import {
  DLT_IMPORT_FIELDS,
  guessColumnMapping,
  mapCsvRows,
  missingRequiredFields,
  parseCsv,
  type ColumnMapping,
  type DltImportKind,
} from "./csv-mapping";
import {
  DLT_CATEGORIES,
  DLT_CATEGORY_LABELS,
  DLT_CATEGORY_SUFFIX,
  type DltCategory,
  type DltRegistryView,
} from "./schema";

// ─── Shared bits ──────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: DltCategory }) {
  const label = DLT_CATEGORY_LABELS[category] ?? category;
  const suffix = DLT_CATEGORY_SUFFIX[category];
  return (
    <Badge tone={category === "promotional" ? "neutral" : "info"}>
      {label}
      {suffix ? <span className="ml-1 font-mono">-{suffix}</span> : null}
    </Badge>
  );
}

function CategorySelect({
  value,
  onChange,
  label = "Category",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          {DLT_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {DLT_CATEGORY_LABELS[c]} (-{DLT_CATEGORY_SUFFIX[c]})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

interface ConfirmState {
  title: string;
  detail: string;
  onConfirm: () => void;
}

// ─── CSV import wizard ────────────────────────────────────────────────────

type ImportStep = "source" | "mapping" | "preview";

const IMPORT_KIND_LABEL: Record<DltImportKind, string> = {
  entities: "entities",
  headers: "headers",
  templates: "templates",
};

function CsvImportModal({
  kind,
  open,
  onClose,
  onImported,
}: {
  kind: DltImportKind;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = React.useState<ImportStep>("source");
  const [csvText, setCsvText] = React.useState("");
  const [pickedName, setPickedName] = React.useState<string | null>(null);
  const [sourceError, setSourceError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [busy, setBusy] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);

  const fields = DLT_IMPORT_FIELDS[kind];
  const headings = rows[0] ?? [];
  const dataRows = React.useMemo(() => rows.slice(1), [rows]);
  const missing = missingRequiredFields(mapping, kind);
  const mapped = React.useMemo(
    () => (step === "preview" ? mapCsvRows(dataRows, mapping, kind) : []),
    [step, dataRows, mapping, kind],
  );

  function reset() {
    setStep("source");
    setCsvText("");
    setPickedName(null);
    setSourceError(null);
    setRows([]);
    setMapping({});
    setImportError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function handlePick(pick: SabFilePick) {
    setSourceError(null);
    setBusy(true);
    try {
      const res = await fetch(pick.url);
      if (!res.ok) throw new Error(`fetch failed (${res.status})`);
      const text = await res.text();
      setCsvText(text);
      setPickedName(pick.name);
    } catch {
      setSourceError("Could not read that file from SabFiles. Try again or paste the CSV below.");
    } finally {
      setBusy(false);
    }
  }

  function goToMapping() {
    setSourceError(null);
    const parsed = parseCsv(csvText);
    if (parsed.length < 2) {
      setSourceError("Need a heading row plus at least one data row.");
      return;
    }
    setRows(parsed);
    setMapping(guessColumnMapping(parsed[0], kind));
    setStep("mapping");
  }

  async function runImport() {
    setBusy(true);
    setImportError(null);
    const res = await importDltCsvAction({ kind, records: mapped });
    setBusy(false);
    if (!res.success) {
      setImportError(res.error);
      return;
    }
    const { inserted, updated, errors } = res.summary;
    toast.success(
      `Imported ${inserted + updated} ${IMPORT_KIND_LABEL[kind]} (${inserted} new, ${updated} updated)` +
        (errors.length ? `, ${errors.length} row${errors.length === 1 ? "" : "s"} skipped` : ""),
    );
    if (errors.length) {
      setImportError(
        errors
          .slice(0, 5)
          .map((e) => `Row ${e.row}: ${e.error}`)
          .join(" · ") + (errors.length > 5 ? ` · +${errors.length - 5} more` : ""),
      );
    }
    onImported();
    if (!errors.length) close();
  }

  const footer =
    step === "source" ? (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button variant="primary" onClick={goToMapping} disabled={!csvText.trim() || busy}>
          Next: map columns
        </Button>
      </div>
    ) : step === "mapping" ? (
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep("source")}>
          Back
        </Button>
        <Button variant="primary" onClick={() => setStep("preview")} disabled={missing.length > 0}>
          Next: preview rows
        </Button>
      </div>
    ) : (
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep("mapping")}>
          Back
        </Button>
        <Button variant="primary" onClick={runImport} loading={busy} disabled={mapped.length === 0}>
          Import {mapped.length} row{mapped.length === 1 ? "" : "s"}
        </Button>
      </div>
    );

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={`Import ${IMPORT_KIND_LABEL[kind]} from CSV`}
      description="Operator-portal exports vary — pick a file, confirm the column mapping, preview, then import."
      footer={footer}
    >
      {step === "source" && (
        <div className="space-y-4">
          <div className="rounded-[var(--st-radius)] border-2 border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-6 py-6 text-center">
            <Upload className="mx-auto mb-3 h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <p className="mb-3 text-sm text-[var(--st-text)]">
              Pick the portal export from SabFiles, or paste the CSV text below.
            </p>
            <SabFilePickerButton accept="document" onPick={handlePick} variant="default">
              Choose CSV from SabFiles
            </SabFilePickerButton>
            {pickedName && (
              <p className="mt-2 text-xs text-[var(--st-text-secondary)]">Loaded: {pickedName}</p>
            )}
          </div>
          <Field label="Or paste CSV text">
            <Textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"headerId,header,category\n123,SABOTP,transactional"}
              className="font-mono text-xs"
            />
          </Field>
          {sourceError && <Alert tone="warning">{sourceError}</Alert>}
        </div>
      )}

      {step === "mapping" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--st-text-secondary)]">
            We guessed a mapping from your heading row ({headings.length} columns,{" "}
            {dataRows.length} data rows). Correct anything that looks wrong.
          </p>
          <div className="space-y-3">
            {fields.map((f) => {
              const current = mapping[f.key];
              return (
                <Field
                  key={f.key}
                  label={`${f.label}${f.required ? " (required)" : ""}`}
                >
                  <Select
                    value={current === null || current === undefined ? "__none__" : String(current)}
                    onValueChange={(v) =>
                      setMapping((m) => ({
                        ...m,
                        [f.key]: v === "__none__" ? null : Number(v),
                      }))
                    }
                  >
                    <SelectTrigger aria-label={`Column for ${f.label}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not mapped</SelectItem>
                      {headings.map((h, i) => (
                        <SelectItem key={`${i}-${h}`} value={String(i)}>
                          Column {i + 1}: {h || "(blank heading)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              );
            })}
          </div>
          {missing.length > 0 && (
            <Alert tone="warning" title="Required fields unmapped">
              Map {missing.map((f) => f.label).join(", ")} to continue.
            </Alert>
          )}
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--st-text-secondary)]">
            {mapped.length} row{mapped.length === 1 ? "" : "s"} will be validated and
            upserted (existing IDs are updated, new ones created). Showing the first{" "}
            {Math.min(mapped.length, 15)}.
          </p>
          <div className="max-h-72 overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr>
                  {fields.map((f) => (
                    <Th key={f.key}>{f.label}</Th>
                  ))}
                </Tr>
              </THead>
              <TBody>
                {mapped.slice(0, 15).map((rec, i) => (
                  <Tr key={i}>
                    {fields.map((f) => (
                      <Td key={f.key} className="max-w-[16rem] truncate font-mono text-xs">
                        {Array.isArray(rec[f.key])
                          ? (rec[f.key] as string[]).join(", ")
                          : String(rec[f.key] ?? "")}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
          {importError && <Alert tone="warning">{importError}</Alert>}
        </div>
      )}
    </Modal>
  );
}

// ─── Entity / header / template edit modals ───────────────────────────────

function EntityModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: { id?: string; peId: string; name: string; status: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [peId, setPeId] = React.useState("");
  const [name, setName] = React.useState("");
  const [status, setStatus] = React.useState("active");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPeId(initial?.peId ?? "");
      setName(initial?.name ?? "");
      setStatus(initial?.status ?? "active");
      setError(null);
    }
  }, [open, initial]);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveDltEntityAction({ id: initial?.id, peId, name, status });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? "Edit principal entity" : "Add principal entity"}
      description="The PE ID issued by your DLT operator portal."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={busy} disabled={!peId.trim()}>
            Save entity
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="PE ID">
          <Input
            value={peId}
            onChange={(e) => setPeId(e.target.value)}
            placeholder="1101456789012345678"
            className="font-mono"
          />
        </Field>
        <Field label="Entity name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Pvt. Ltd." />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function HeaderModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: { id?: string; headerId: string; header: string; category: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [headerId, setHeaderId] = React.useState("");
  const [header, setHeader] = React.useState("");
  const [category, setCategory] = React.useState("transactional");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setHeaderId(initial?.headerId ?? "");
      setHeader(initial?.header ?? "");
      setCategory(initial?.category ?? "transactional");
      setError(null);
    }
  }, [open, initial]);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveDltHeaderAction({ id: initial?.id, headerId, header, category });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? "Edit header" : "Add header"}
      description="Registered sender ID (6-alpha or 6-numeric on most operators)."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={save}
            loading={busy}
            disabled={!headerId.trim() || !header.trim()}
          >
            Save header
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Header ID">
          <Input
            value={headerId}
            onChange={(e) => setHeaderId(e.target.value)}
            placeholder="1105xxxxxxxxxx"
            className="font-mono"
          />
        </Field>
        <Field label="Header (sender)">
          <Input
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            placeholder="SABOTP"
            className="font-mono uppercase"
          />
        </Field>
        <CategorySelect value={category} onChange={setCategory} />
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function TemplateModal({
  open,
  initial,
  headers,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: {
    id?: string;
    templateId: string;
    body: string;
    category: string;
    peId: string;
    headerIds: string[];
    status: string;
  } | null;
  headers: DltRegistryView["headers"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [templateId, setTemplateId] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState("transactional");
  const [peId, setPeId] = React.useState("");
  const [headerIds, setHeaderIds] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState("active");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTemplateId(initial?.templateId ?? "");
      setBody(initial?.body ?? "");
      setCategory(initial?.category ?? "transactional");
      setPeId(initial?.peId ?? "");
      setHeaderIds(initial?.headerIds ?? []);
      setStatus(initial?.status ?? "active");
      setError(null);
    }
  }, [open, initial]);

  function toggleHeaderId(id: string) {
    setHeaderIds((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id],
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await saveDltTemplateAction({
      id: initial?.id,
      templateId,
      body,
      category,
      peId,
      headerIds,
      status,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={initial?.id ? "Edit content template" : "Add content template"}
      description={
        <>
          The registered body, exactly as approved on the portal —{" "}
          <code className="rounded bg-[var(--st-bg-secondary)] px-1 text-xs">{"{#var#}"}</code>{" "}
          placeholders included.
        </>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={save}
            loading={busy}
            disabled={!templateId.trim() || !body.trim()}
          >
            Save template
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Template ID (TE_ID)">
            <Input
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="1107xxxxxxxxxx"
              className="font-mono"
            />
          </Field>
          <Field label="PE ID (owner)">
            <Input
              value={peId}
              onChange={(e) => setPeId(e.target.value)}
              placeholder="1101xxxxxxxxxx"
              className="font-mono"
            />
          </Field>
        </div>
        <Field label="Registered body">
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Your OTP is {#var#}. Do not share it with anyone."
            className="font-mono text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <CategorySelect value={category} onChange={setCategory} />
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="space-y-2">
          <span className="block text-xs font-medium text-[var(--st-text)]">
            Bound headers ({headerIds.length})
          </span>
          {headers.length === 0 ? (
            <p className="text-xs text-[var(--st-text-secondary)]">
              No headers registered yet — add headers first to bind them here.
            </p>
          ) : (
            <div className="flex max-h-36 flex-wrap gap-2 overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2">
              {headers.map((h) => {
                const on = headerIds.includes(h.headerId);
                return (
                  <Button
                    key={h.id}
                    size="sm"
                    variant={on ? "secondary" : "ghost"}
                    aria-pressed={on}
                    onClick={() => toggleHeaderId(h.headerId)}
                    className="font-mono"
                  >
                    {h.header}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────

export function DltHubClient({ initial }: { initial: DltRegistryView }) {
  const { toast } = useToast();
  const [registry, setRegistry] = React.useState<DltRegistryView>(initial);

  const [entityModal, setEntityModal] = React.useState<{
    open: boolean;
    initial: Parameters<typeof EntityModal>[0]["initial"];
  }>({ open: false, initial: null });
  const [headerModal, setHeaderModal] = React.useState<{
    open: boolean;
    initial: Parameters<typeof HeaderModal>[0]["initial"];
  }>({ open: false, initial: null });
  const [templateModal, setTemplateModal] = React.useState<{
    open: boolean;
    initial: Parameters<typeof TemplateModal>[0]["initial"];
  }>({ open: false, initial: null });
  const [importKind, setImportKind] = React.useState<DltImportKind | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = React.useState(false);

  // Chain form state.
  const [chainPeId, setChainPeId] = React.useState(initial.chain?.peId ?? "");
  const [chainTm1, setChainTm1] = React.useState(initial.chain?.tmIds[0] ?? "");
  const [chainTm2, setChainTm2] = React.useState(initial.chain?.tmIds[1] ?? "");
  const [chainBusy, setChainBusy] = React.useState(false);
  const [chainError, setChainError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const res = await loadDltRegistryAction();
    if (res.success) {
      setRegistry(res.registry);
      setChainPeId(res.registry.chain?.peId ?? "");
      setChainTm1(res.registry.chain?.tmIds[0] ?? "");
      setChainTm2(res.registry.chain?.tmIds[1] ?? "");
    }
  }, []);

  function confirmDelete(title: string, detail: string, run: () => Promise<{ success: boolean; error?: string }>) {
    setConfirm({
      title,
      detail,
      onConfirm: () => {
        setConfirmBusy(true);
        void run().then((res) => {
          setConfirmBusy(false);
          setConfirm(null);
          if (res.success) {
            toast.success("Deleted");
            void refresh();
          } else {
            toast.error(res.error ?? "Delete failed");
          }
        });
      },
    });
  }

  async function saveChain() {
    setChainBusy(true);
    setChainError(null);
    const tmIds = [chainTm1, chainTm2].map((s) => s.trim()).filter(Boolean);
    const res = await saveDltChainAction({ peId: chainPeId, tmIds });
    setChainBusy(false);
    if (!res.success) {
      setChainError(res.error);
      return;
    }
    toast.success("TM chain saved");
    void refresh();
  }

  const chainConfigured = !!registry.chain?.peId;

  return (
    <div className="space-y-6 pb-10">
      {/* Status summary strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Principal entities"
          value={registry.entities.length}
          icon={Building}
        />
        <StatCard label="Registered headers" value={registry.headers.length} icon={Hash} />
        <StatCard
          label="Content templates"
          value={registry.templates.length}
          icon={FileText}
          delta={{
            value: `${registry.templates.filter((t) => t.status === "active").length} active`,
            tone: "neutral",
          }}
        />
        <StatCard
          label="PE → TM chain"
          value={chainConfigured ? "Configured" : "Not set"}
          icon={Link2}
          delta={{
            value: chainConfigured
              ? `${registry.chain?.tmIds.length ?? 0} telemarketer${(registry.chain?.tmIds.length ?? 0) === 1 ? "" : "s"}`
              : "required for delivery",
            tone: chainConfigured ? "up" : "down",
          }}
        />
      </div>

      <Tabs defaultValue="entities" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="chain">TM chain</TabsTrigger>
        </TabsList>

        {/* ── Entities ── */}
        <TabsContent value="entities" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Principal entities</CardTitle>
                  <CardDescription>
                    Operator-issued PE IDs your workspace sends under.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Upload}
                    onClick={() => setImportKind("entities")}
                  >
                    Import CSV
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => setEntityModal({ open: true, initial: null })}
                  >
                    Add entity
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {registry.entities.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Building}
                    title="No entities registered"
                    description="Add the PE ID from your DLT operator portal, or import the portal's CSV export."
                  />
                </div>
              ) : (
                <Table>
                  <THead>
                    <Tr>
                      <Th>PE ID</Th>
                      <Th>Name</Th>
                      <Th>Status</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {registry.entities.map((e) => (
                      <Tr key={e.id}>
                        <Td className="font-mono text-xs">{e.peId}</Td>
                        <Td>{e.name || <span className="text-[var(--st-text-secondary)]">—</span>}</Td>
                        <Td>
                          <Badge tone={e.status === "active" ? "success" : "neutral"} dot>
                            {e.status}
                          </Badge>
                        </Td>
                        <Td align="right">
                          <div className="inline-flex gap-1">
                            <IconButton
                              label={`Edit entity ${e.peId}`}
                              icon={Pencil}
                              size="sm"
                              onClick={() => setEntityModal({ open: true, initial: e })}
                            />
                            <IconButton
                              label={`Delete entity ${e.peId}`}
                              icon={Trash2}
                              size="sm"
                              onClick={() =>
                                confirmDelete(
                                  "Delete principal entity?",
                                  `PE ${e.peId} will be removed from the registry. Templates and the chain referencing it are not changed.`,
                                  () => deleteDltEntityAction(e.id),
                                )
                              }
                            />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        {/* ── Headers ── */}
        <TabsContent value="headers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Headers (sender IDs)</CardTitle>
                  <CardDescription>
                    The engine blocks sends from headers that are not registered here.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Upload}
                    onClick={() => setImportKind("headers")}
                  >
                    Import CSV
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => setHeaderModal({ open: true, initial: null })}
                  >
                    Add header
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {registry.headers.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Hash}
                    title="No headers registered"
                    description="Register your approved sender IDs (e.g. SABOTP) with their operator header IDs."
                  />
                </div>
              ) : (
                <Table>
                  <THead>
                    <Tr>
                      <Th>Header</Th>
                      <Th>Header ID</Th>
                      <Th>Category</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {registry.headers.map((h) => (
                      <Tr key={h.id}>
                        <Td className="font-mono font-medium">{h.header}</Td>
                        <Td className="font-mono text-xs">{h.headerId}</Td>
                        <Td>
                          <CategoryBadge category={h.category} />
                        </Td>
                        <Td align="right">
                          <div className="inline-flex gap-1">
                            <IconButton
                              label={`Edit header ${h.header}`}
                              icon={Pencil}
                              size="sm"
                              onClick={() => setHeaderModal({ open: true, initial: h })}
                            />
                            <IconButton
                              label={`Delete header ${h.header}`}
                              icon={Trash2}
                              size="sm"
                              onClick={() =>
                                confirmDelete(
                                  "Delete header?",
                                  `Sends from "${h.header}" will fail DLT scrubbing once removed.`,
                                  () => deleteDltHeaderAction(h.id),
                                )
                              }
                            />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        {/* ── Templates ── */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Content templates</CardTitle>
                  <CardDescription>
                    Approved template bodies with{" "}
                    <code className="rounded bg-[var(--st-bg-secondary)] px-1 text-xs">{"{#var#}"}</code>{" "}
                    placeholders. Outbound bodies must match one of these.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Upload}
                    onClick={() => setImportKind("templates")}
                  >
                    Import CSV
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => setTemplateModal({ open: true, initial: null })}
                  >
                    Add template
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {registry.templates.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={FileText}
                    title="No content templates"
                    description="Import the portal's template export, or add registered templates one by one."
                  />
                </div>
              ) : (
                <Table>
                  <THead>
                    <Tr>
                      <Th>Template ID</Th>
                      <Th>Body</Th>
                      <Th>Category</Th>
                      <Th>Headers</Th>
                      <Th>Status</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {registry.templates.map((t) => (
                      <Tr key={t.id}>
                        <Td className="font-mono text-xs">{t.templateId}</Td>
                        <Td className="max-w-[22rem]">
                          <span className="block truncate font-mono text-xs" title={t.body}>
                            {t.body}
                          </span>
                        </Td>
                        <Td>
                          <CategoryBadge category={t.category} />
                        </Td>
                        <Td className="text-xs text-[var(--st-text-secondary)]">
                          {t.headerIds.length || "—"}
                        </Td>
                        <Td>
                          <Badge tone={t.status === "active" ? "success" : "neutral"} dot>
                            {t.status}
                          </Badge>
                        </Td>
                        <Td align="right">
                          <div className="inline-flex gap-1">
                            <IconButton
                              label={`Edit template ${t.templateId}`}
                              icon={Pencil}
                              size="sm"
                              onClick={() => setTemplateModal({ open: true, initial: t })}
                            />
                            <IconButton
                              label={`Delete template ${t.templateId}`}
                              icon={Trash2}
                              size="sm"
                              onClick={() =>
                                confirmDelete(
                                  "Delete content template?",
                                  `Bodies sent against TE ${t.templateId} will no longer match the registry.`,
                                  () => deleteDltTemplateAction(t.id),
                                )
                              }
                            />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </TabsContent>

        {/* ── Chain ── */}
        <TabsContent value="chain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>PE → TM delivery chain</CardTitle>
              <CardDescription>
                One chain per workspace. TRAI (May 2025) caps the chain at two
                telemarketers between your principal entity and the operator.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Principal entity (PE ID)">
                  <Input
                    value={chainPeId}
                    onChange={(e) => setChainPeId(e.target.value)}
                    placeholder="1101xxxxxxxxxx"
                    className="font-mono"
                  />
                </Field>
                <Field label="Telemarketer 1 (TM ID)">
                  <Input
                    value={chainTm1}
                    onChange={(e) => setChainTm1(e.target.value)}
                    placeholder="optional"
                    className="font-mono"
                  />
                </Field>
                <Field label="Telemarketer 2 (TM ID)">
                  <Input
                    value={chainTm2}
                    onChange={(e) => setChainTm2(e.target.value)}
                    placeholder="optional"
                    className="font-mono"
                  />
                </Field>
              </div>
              {chainError && <Alert tone="danger">{chainError}</Alert>}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  onClick={saveChain}
                  loading={chainBusy}
                  disabled={!chainPeId.trim()}
                >
                  Save chain
                </Button>
                {chainConfigured && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      confirmDelete(
                        "Remove TM chain?",
                        "The engine's chain check will report the workspace as unconfigured.",
                        () => deleteDltChainAction(),
                      )
                    }
                  >
                    Remove chain
                  </Button>
                )}
                {chainConfigured ? (
                  <Badge tone="success" dot>
                    Configured
                  </Badge>
                ) : (
                  <Badge tone="warning" dot>
                    Not configured
                  </Badge>
                )}
              </div>
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <EntityModal
        open={entityModal.open}
        initial={entityModal.initial}
        onClose={() => setEntityModal({ open: false, initial: null })}
        onSaved={() => {
          toast.success("Entity saved");
          void refresh();
        }}
      />
      <HeaderModal
        open={headerModal.open}
        initial={headerModal.initial}
        onClose={() => setHeaderModal({ open: false, initial: null })}
        onSaved={() => {
          toast.success("Header saved");
          void refresh();
        }}
      />
      <TemplateModal
        open={templateModal.open}
        initial={templateModal.initial}
        headers={registry.headers}
        onClose={() => setTemplateModal({ open: false, initial: null })}
        onSaved={() => {
          toast.success("Template saved");
          void refresh();
        }}
      />
      {importKind && (
        <CsvImportModal
          kind={importKind}
          open
          onClose={() => setImportKind(null)}
          onImported={() => void refresh()}
        />
      )}

      {/* Delete confirm */}
      <Modal
        open={confirm !== null}
        onClose={() => (confirmBusy ? undefined : setConfirm(null))}
        size="sm"
        title={confirm?.title ?? ""}
        description={confirm?.detail}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={confirmBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirm?.onConfirm()}
              loading={confirmBusy}
            >
              Delete
            </Button>
          </div>
        }
      />
    </div>
  );
}
