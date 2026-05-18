'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  Upload as UploadIcon,
  } from 'lucide-react';

/**
 * BulkImportWizard — shared CSV import flow for any CRM entity (§5.9).
 *
 * Five steps, navigated with a tab strip + Back/Next/Execute buttons:
 *   1. Upload — pick a `.csv` via `<SabFilePickerButton>` (SabFiles only,
 *      per policy: no free-text URL input).
 *   2. Mapping — match each CSV header to one of the entity's adapter
 *      fields. Auto-matches by name similarity.
 *   3. Dedup — choose which adapter field defines a duplicate, plus a
 *      replace-vs-skip toggle.
 *   4. Preview — server dry-run; renders create/update/skip/error counts
 *      + downloadable preview CSV.
 *   5. Execute — calls the server-side `executeBulkImport` action.
 *
 * Permission gating happens server-side in the adapter — the wizard
 * doesn't pre-check. RBAC failures surface in the execute step.
 *
 * SabFiles policy: the file input goes through `<SabFilePickerButton>`,
 * which only exposes Library + Upload modes. No URL paste is exposed by
 * design.
 */

import * as React from 'react';
import Papa from 'papaparse';

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import {
    executeBulkImport,
    getBulkImportSchema,
    previewBulkImport,
    type BulkImportPreviewResult,
    type WizardSchemaResponse,
} from '@/app/actions/crm-bulk-import.actions';
import type { ExecuteResult } from '@/lib/bulk-import/adapters/types';

export interface BulkImportWizardField {
    field: string;
    label: string;
    required: boolean;
    validator?: (raw: string) => string | null;
    deduper?: (value: Record<string, unknown>) => string | null;
}

export interface BulkImportWizardProps {
    /** Which entity we're importing — also drives the server adapter lookup. */
    entityKind: string;
    /**
     * Optional client-side schema override. When omitted, the wizard
     * fetches the schema from `getBulkImportSchema(entityKind)` on
     * mount — the typical path.
     */
    targetSchema?: BulkImportWizardField[];
    /**
     * Optional existing rows for client-side dedup hints. The preview
     * step is server-driven by design, but a small inline dedup signal
     * helps user confidence at the mapping step.
     */
    existingRowsForDedupe?: Array<Record<string, unknown>>;
    /** Called after a successful execute with the server result. */
    onCompleted?: (result: ExecuteResult) => void;
    /** Optional className for the outer container. */
    className?: string;
}

type WizardStep = 'upload' | 'mapping' | 'dedup' | 'preview' | 'execute';

const STEPS: { id: WizardStep; label: string }[] = [
    { id: 'upload', label: '1. Upload' },
    { id: 'mapping', label: '2. Map fields' },
    { id: 'dedup', label: '3. Dedup rules' },
    { id: 'preview', label: '4. Preview' },
    { id: 'execute', label: '5. Execute' },
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function normalizeHeader(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function autoMatch(
    csvHeaders: string[],
    fields: BulkImportWizardField[],
): Record<string, string> {
    const out: Record<string, string> = {};
    const fieldByNorm = new Map<string, string>();
    for (const f of fields) {
        fieldByNorm.set(normalizeHeader(f.field), f.field);
        fieldByNorm.set(normalizeHeader(f.label), f.field);
    }
    for (const h of csvHeaders) {
        const norm = normalizeHeader(h);
        const exact = fieldByNorm.get(norm);
        if (exact) {
            out[h] = exact;
            continue;
        }
        // Best-effort prefix match.
        for (const [k, v] of fieldByNorm.entries()) {
            if (norm && (k.startsWith(norm) || norm.startsWith(k))) {
                out[h] = v;
                break;
            }
        }
    }
    return out;
}

function csvBlobUrl(csv: string): string {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    return URL.createObjectURL(blob);
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function BulkImportWizard({
    entityKind,
    targetSchema: targetSchemaProp,
    onCompleted,
    className,
}: BulkImportWizardProps): React.ReactElement {
    const { toast } = useZoruToast();

    const [step, setStep] = React.useState<WizardStep>('upload');
    const [schema, setSchema] = React.useState<BulkImportWizardField[] | null>(
        targetSchemaProp ?? null,
    );
    const [schemaError, setSchemaError] = React.useState<string | null>(null);

    // Upload
    const [pickedFile, setPickedFile] = React.useState<SabFilePick | null>(null);
    const [csvText, setCsvText] = React.useState<string>('');
    const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
    const [csvRowCount, setCsvRowCount] = React.useState(0);
    const [downloading, setDownloading] = React.useState(false);

    // Mapping
    const [mapping, setMapping] = React.useState<Record<string, string>>({});

    // Dedup
    const [dedupField, setDedupField] = React.useState<string>('');
    const [updateExisting, setUpdateExisting] = React.useState(false);

    // Preview
    const [preview, setPreview] = React.useState<BulkImportPreviewResult | null>(null);
    const [previewBusy, setPreviewBusy] = React.useState(false);

    // Execute
    const [execResult, setExecResult] = React.useState<ExecuteResult | null>(null);
    const [execBusy, setExecBusy] = React.useState(false);

    /* ─── Schema load (only when not provided) ───────────────────────── */
    React.useEffect(() => {
        if (targetSchemaProp) {
            setSchema(targetSchemaProp);
            return;
        }
        let cancelled = false;
        (async () => {
            const resp = await getBulkImportSchema(entityKind);
            if (cancelled) return;
            if (!resp) {
                setSchemaError(`No bulk-import adapter registered for "${entityKind}".`);
                return;
            }
            setSchema(
                (resp as WizardSchemaResponse).fields.map((f) => ({
                    field: f.field,
                    label: f.label,
                    required: f.required,
                })),
            );
        })().catch((e) => {
            console.error('[BulkImportWizard] schema load failed:', e);
            setSchemaError('Could not load schema.');
        });
        return () => {
            cancelled = true;
        };
    }, [entityKind, targetSchemaProp]);

    /* ─── Default dedupField — first required field with a dedupable name ─ */
    React.useEffect(() => {
        if (dedupField || !schema || schema.length === 0) return;
        const candidate =
            schema.find((f) => f.field === 'email') ??
            schema.find((f) => f.field === 'sku') ??
            schema.find((f) => f.field === 'gstin') ??
            schema.find((f) => f.field === 'name') ??
            schema[0];
        if (candidate) setDedupField(candidate.field);
    }, [dedupField, schema]);

    /* ─── File picker handler ────────────────────────────────────────── */
    const handlePick = React.useCallback(
        async (pick: SabFilePick): Promise<void> => {
            setPickedFile(pick);
            setDownloading(true);
            try {
                const res = await fetch(pick.url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                const parsed = Papa.parse<Record<string, string>>(text, {
                    header: true,
                    skipEmptyLines: true,
                });
                const headers = parsed.meta.fields ?? [];
                setCsvText(text);
                setCsvHeaders(headers);
                setCsvRowCount(parsed.data.length);
                if (schema) {
                    setMapping(autoMatch(headers, schema));
                }
                setStep('mapping');
            } catch (e) {
                toast({
                    title: 'Could not read CSV',
                    description: e instanceof Error ? e.message : 'Unknown error',
                    variant: 'destructive',
                });
            } finally {
                setDownloading(false);
            }
        },
        [schema, toast],
    );

    /* ─── Mapping step actions ───────────────────────────────────────── */
    const requiredOk = React.useMemo<boolean>(() => {
        if (!schema) return false;
        const requiredFields = schema.filter((f) => f.required).map((f) => f.field);
        const mappedTargets = new Set(Object.values(mapping));
        return requiredFields.every((f) => mappedTargets.has(f));
    }, [mapping, schema]);

    /* ─── Preview step ───────────────────────────────────────────────── */
    const runPreview = React.useCallback(async (): Promise<void> => {
        if (!csvText) return;
        setPreviewBusy(true);
        try {
            const { result, error } = await previewBulkImport({
                entityKind,
                csv: csvText,
                mapping,
                dedupField: dedupField || undefined,
                updateExisting,
            });
            if (error) {
                toast({
                    title: 'Preview failed',
                    description: error,
                    variant: 'destructive',
                });
                return;
            }
            setPreview(result ?? null);
        } finally {
            setPreviewBusy(false);
        }
    }, [csvText, dedupField, entityKind, mapping, toast, updateExisting]);

    /* ─── Execute step ───────────────────────────────────────────────── */
    const runExecute = React.useCallback(async (): Promise<void> => {
        if (!csvText) return;
        setExecBusy(true);
        try {
            const { result, error } = await executeBulkImport({
                entityKind,
                csv: csvText,
                mapping,
                dedupField: dedupField || undefined,
                updateExisting,
            });
            if (error) {
                toast({
                    title: 'Import failed',
                    description: error,
                    variant: 'destructive',
                });
                return;
            }
            if (result) {
                setExecResult(result);
                onCompleted?.(result);
                toast({
                    title: 'Import complete',
                    description: `Created ${result.created}, updated ${result.updated}, skipped ${result.skipped}.`,
                });
            }
        } finally {
            setExecBusy(false);
        }
    }, [
        csvText,
        dedupField,
        entityKind,
        mapping,
        onCompleted,
        toast,
        updateExisting,
    ]);

    /* ─── Step nav ───────────────────────────────────────────────────── */
    const canGoNext = React.useMemo(() => {
        if (step === 'upload') return csvHeaders.length > 0;
        if (step === 'mapping') return requiredOk;
        if (step === 'dedup') return true;
        if (step === 'preview') return preview != null;
        return false;
    }, [csvHeaders.length, preview, requiredOk, step]);

    const goNext = React.useCallback(async (): Promise<void> => {
        if (step === 'upload') setStep('mapping');
        else if (step === 'mapping') setStep('dedup');
        else if (step === 'dedup') {
            setStep('preview');
            await runPreview();
        } else if (step === 'preview') setStep('execute');
    }, [runPreview, step]);

    const goBack = React.useCallback((): void => {
        if (step === 'mapping') setStep('upload');
        else if (step === 'dedup') setStep('mapping');
        else if (step === 'preview') setStep('dedup');
        else if (step === 'execute') setStep('preview');
    }, [step]);

    /* ─── Render helpers ─────────────────────────────────────────────── */
    if (schemaError) {
        return (
            <ZoruCard className={cn('p-6', className)}>
                <p className="text-sm text-zoru-danger">{schemaError}</p>
            </ZoruCard>
        );
    }
    if (!schema) {
        return (
            <ZoruCard className={cn('flex items-center gap-2 p-6 text-sm text-zoru-ink-muted', className)}>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading schema…
            </ZoruCard>
        );
    }

    return (
        <ZoruCard className={cn('flex w-full flex-col gap-4 p-4', className)}>
            {/* Step strip */}
            <ol className="flex flex-wrap items-center gap-2 text-[12px]">
                {STEPS.map((s) => {
                    const active = step === s.id;
                    return (
                        <li
                            key={s.id}
                            className={cn(
                                'rounded-full border px-2 py-0.5',
                                active
                                    ? 'border-zoru-accent bg-zoru-accent/10 text-zoru-ink'
                                    : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted',
                            )}
                        >
                            {s.label}
                        </li>
                    );
                })}
            </ol>

            {/* Step 1 — Upload */}
            {step === 'upload' ? (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-zoru-ink-muted">
                        Pick a CSV from SabFiles or upload a new one. The file
                        must include a header row.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="document"
                            onPick={(p) => void handlePick(p)}
                        >
                            <UploadIcon /> Choose CSV
                        </SabFilePickerButton>
                        {downloading ? (
                            <span className="inline-flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading…
                            </span>
                        ) : null}
                        {pickedFile && !downloading ? (
                            <span className="inline-flex items-center gap-1 text-[12.5px] text-zoru-ink">
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                {pickedFile.name}{' '}
                                <ZoruBadge variant="secondary">{csvRowCount} rows</ZoruBadge>
                            </span>
                        ) : null}
                    </div>
                    <p className="text-[11.5px] text-zoru-ink-muted">
                        Per SabNode policy, all files live in SabFiles — there
                        is no free-text URL paste.
                    </p>
                </div>
            ) : null}

            {/* Step 2 — Mapping */}
            {step === 'mapping' ? (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-zoru-ink-muted">
                        Match each CSV column to a field on the {entityKind}{' '}
                        entity. Required fields are marked.
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {csvHeaders.map((h) => (
                            <div
                                key={h}
                                className="flex items-center gap-2 rounded-md border border-zoru-line p-2"
                            >
                                <span className="flex-1 truncate text-[13px] text-zoru-ink">
                                    {h}
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                <ZoruSelect
                                    value={mapping[h] ?? '__skip__'}
                                    onValueChange={(v) => {
                                        setMapping((prev) => {
                                            const next = { ...prev };
                                            if (v === '__skip__') delete next[h];
                                            else next[h] = v;
                                            return next;
                                        });
                                    }}
                                >
                                    <ZoruSelectTrigger className="w-48 text-[12.5px]">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="__skip__">
                                            (skip column)
                                        </ZoruSelectItem>
                                        {schema.map((f) => (
                                            <ZoruSelectItem
                                                key={f.field}
                                                value={f.field}
                                            >
                                                {f.label}
                                                {f.required ? ' *' : ''}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        ))}
                    </div>
                    {!requiredOk ? (
                        <p className="text-[12px] text-amber-600">
                            Map all required fields (marked with *) before continuing.
                        </p>
                    ) : null}
                </div>
            ) : null}

            {/* Step 3 — Dedup */}
            {step === 'dedup' ? (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-zoru-ink-muted">
                        Choose which field defines a duplicate. Existing rows
                        can either be replaced or skipped.
                    </p>
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="dedup-field">Dedup by</ZoruLabel>
                        <ZoruSelect
                            value={dedupField}
                            onValueChange={setDedupField}
                        >
                            <ZoruSelectTrigger id="dedup-field" className="w-64">
                                <ZoruSelectValue placeholder="Pick a field" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {schema.map((f) => (
                                    <ZoruSelectItem
                                        key={f.field}
                                        value={f.field}
                                    >
                                        {f.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zoru-ink">
                        <input
                            type="checkbox"
                            checked={updateExisting}
                            onChange={(e) => setUpdateExisting(e.target.checked)}
                        />
                        Replace existing rows that match the dedup field
                        (otherwise duplicates are skipped).
                    </label>
                </div>
            ) : null}

            {/* Step 4 — Preview */}
            {step === 'preview' ? (
                <div className="flex flex-col gap-3">
                    {previewBusy ? (
                        <p className="inline-flex items-center gap-2 text-sm text-zoru-ink-muted">
                            <Loader2 className="h-4 w-4 animate-spin" /> Running dry-run…
                        </p>
                    ) : preview ? (
                        <>
                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                <ZoruBadge variant="default">
                                    {preview.totalRows} total
                                </ZoruBadge>
                                <ZoruBadge variant="secondary">
                                    {preview.createCount} create
                                </ZoruBadge>
                                <ZoruBadge variant="secondary">
                                    {preview.updateCount} update
                                </ZoruBadge>
                                <ZoruBadge variant="secondary">
                                    {preview.skipCount} skip
                                </ZoruBadge>
                                {preview.errorCount > 0 ? (
                                    <ZoruBadge variant="danger">
                                        {preview.errorCount} error
                                    </ZoruBadge>
                                ) : null}
                                <a
                                    href={csvBlobUrl(preview.previewCsv)}
                                    download={`${entityKind}-preview-${new Date()
                                        .toISOString()
                                        .slice(0, 10)}.csv`}
                                    className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-zoru-accent hover:underline"
                                >
                                    <Download className="h-3.5 w-3.5" /> Download
                                    preview CSV
                                </a>
                            </div>
                            <div className="max-h-80 overflow-auto rounded-md border border-zoru-line">
                                <table className="w-full text-[12.5px]">
                                    <thead className="bg-zoru-bg text-zoru-ink-muted">
                                        <tr>
                                            <th className="px-2 py-1 text-left">Row</th>
                                            <th className="px-2 py-1 text-left">Action</th>
                                            <th className="px-2 py-1 text-left">Reason / Existing</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.rows.slice(0, 200).map((r) => (
                                            <tr
                                                key={r.rowIndex}
                                                className="border-t border-zoru-line"
                                            >
                                                <td className="px-2 py-1 text-zoru-ink-muted">
                                                    {r.rowIndex}
                                                </td>
                                                <td className="px-2 py-1">
                                                    <ZoruBadge
                                                        variant={
                                                            r.action === 'create'
                                                                ? 'secondary'
                                                                : r.action === 'update'
                                                                  ? 'default'
                                                                  : r.action === 'skip'
                                                                    ? 'outline'
                                                                    : 'danger'
                                                        }
                                                    >
                                                        {r.action}
                                                    </ZoruBadge>
                                                </td>
                                                <td className="px-2 py-1 text-zoru-ink-muted">
                                                    {r.reason ?? r.existingId ?? ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.rows.length > 200 ? (
                                    <p className="px-2 py-1 text-[11.5px] text-zoru-ink-muted">
                                        Showing first 200 rows. Download the
                                        preview CSV for the full list.
                                    </p>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-zoru-ink-muted">
                            No preview yet.
                        </p>
                    )}
                </div>
            ) : null}

            {/* Step 5 — Execute */}
            {step === 'execute' ? (
                <div className="flex flex-col gap-3">
                    {execResult ? (
                        <div className="flex flex-col gap-2">
                            <p className="inline-flex items-center gap-2 text-sm text-emerald-600">
                                <Check className="h-4 w-4" /> Import complete
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                <ZoruBadge variant="secondary">
                                    {execResult.created} created
                                </ZoruBadge>
                                <ZoruBadge variant="secondary">
                                    {execResult.updated} updated
                                </ZoruBadge>
                                <ZoruBadge variant="outline">
                                    {execResult.skipped} skipped
                                </ZoruBadge>
                                {execResult.errors.length > 0 ? (
                                    <ZoruBadge variant="danger">
                                        {execResult.errors.length} errors
                                    </ZoruBadge>
                                ) : null}
                            </div>
                            {execResult.errors.length > 0 ? (
                                <ul className="max-h-48 overflow-auto rounded border border-zoru-line bg-zoru-bg p-2 text-[12px] text-zoru-ink-muted">
                                    {execResult.errors.slice(0, 50).map((e) => (
                                        <li key={`${e.rowIndex}-${e.error}`}>
                                            Row {e.rowIndex}: {e.error}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ) : (
                        <p className="text-sm text-zoru-ink-muted">
                            Review the counts above, then commit the import.
                            Nothing has been written yet.
                        </p>
                    )}
                </div>
            ) : null}

            {/* Footer nav */}
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-zoru-line pt-3">
                <ZoruButton
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    disabled={step === 'upload' || execBusy}
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                </ZoruButton>

                {step !== 'execute' ? (
                    <ZoruButton
                        type="button"
                        onClick={() => void goNext()}
                        disabled={!canGoNext || previewBusy}
                        className="ml-auto"
                    >
                        {step === 'dedup' ? 'Run preview' : 'Next'}
                        <ArrowRight className="h-3.5 w-3.5" />
                    </ZoruButton>
                ) : (
                    <ZoruButton
                        type="button"
                        onClick={() => void runExecute()}
                        disabled={execBusy || !!execResult}
                        className="ml-auto"
                    >
                        {execBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Play className="h-3.5 w-3.5" />
                        )}
                        {execResult ? 'Done' : 'Execute import'}
                    </ZoruButton>
                )}
            </div>
        </ZoruCard>
    );
}

export default BulkImportWizard;
