'use client';

/**
 * Generic Excel/CSV import wizard for the CRM import-export page.
 *
 * Three steps:
 *   1. Pick an entity + upload a file. Calls `parseImportFile` to peek
 *      at headers and the first 50 rows.
 *   2. Map every entity field to a detected column header. An
 *      "Auto-detect" helper does a case-insensitive prefix match.
 *   3. Submit → kick off a server-side import job + poll
 *      `getImportJobStatus` every second for progress / errors.
 *
 * The wizard is a controlled child of the import-export page — the
 * parent owns the open/close state and a `key` reset hook so each
 * "Start import" press starts from step 1 cleanly.
 */

import * as React from 'react';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Loader2,
    Sparkles,
    UploadCloud,
    XCircle,
    Download,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, Input, Label, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import {
    ENTITY_SCHEMAS,
    listEntitySchemas,
    type EntitySchema,
    type ImportField,
} from '@/lib/crm-import/entity-schemas';
import {
    createImportJob,
    getImportJobStatus,
    parseImportFile,
    type ImportJobStatus,
    type ParseImportFileResult,
} from '@/app/actions/crm-import.actions';

type WizardStep = 'pick' | 'map' | 'progress';

interface ImportWizardProps {
    onClose?: () => void;
    onJobCreated?: () => void;
}

const POLL_INTERVAL_MS = 1000;

const ENTITIES = listEntitySchemas();

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (): void => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Unexpected file read result'));
                return;
            }
            // Strip the `data:...;base64,` prefix — server expects raw.
            const idx = result.indexOf(',');
            resolve(idx === -1 ? result : result.slice(idx + 1));
        };
        reader.onerror = (): void => reject(reader.error ?? new Error('Read failed'));
        reader.readAsDataURL(file);
    });
}

/**
 * Pre-populate the mapping by matching every entity field against
 * the detected headers — case-insensitive, prefix-tolerant.
 */
function autoDetectMapping(
    schema: EntitySchema,
    headers: string[],
): Record<string, string> {
    const out: Record<string, string> = {};
    const normHeaders = headers.map((h) => ({
        raw: h,
        norm: h.toLowerCase().replace(/[\s_-]+/g, ''),
    }));
    for (const field of schema.fields) {
        const candidates = [
            field.name,
            field.label,
            field.name.replace(/_/g, ''),
            field.name.replace(/_/g, ' '),
        ].map((c) => c.toLowerCase().replace(/[\s_-]+/g, ''));
        const hit = normHeaders.find((h) => candidates.includes(h.norm));
        if (hit) {
            out[field.name] = hit.raw;
            continue;
        }
        // Prefix fallback.
        const prefix = normHeaders.find((h) =>
            candidates.some((c) => c.length > 2 && h.norm.startsWith(c)),
        );
        if (prefix) out[field.name] = prefix.raw;
    }
    return out;
}

export function ImportWizard({
    onClose,
    onJobCreated,
}: ImportWizardProps): React.ReactElement {
    const [step, setStep] = React.useState<WizardStep>('pick');
    const [entityType, setEntityType] = React.useState<string>(
        ENTITIES[0]?.entityType ?? 'employees',
    );
    const [file, setFile] = React.useState<File | null>(null);
    const [fileBase64, setFileBase64] = React.useState<string>('');
    const [parseResult, setParseResult] = React.useState<ParseImportFileResult | null>(
        null,
    );
    const [mapping, setMapping] = React.useState<Record<string, string>>({});
    const [isParsing, setIsParsing] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [jobId, setJobId] = React.useState<string | null>(null);
    const [jobStatus, setJobStatus] = React.useState<ImportJobStatus | null>(null);
    const [showAllErrors, setShowAllErrors] = React.useState(false);

    const schema = ENTITY_SCHEMAS[entityType];

    /* ─── poll job status while running ─────────────────────────── */

    React.useEffect(() => {
        if (!jobId) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const tick = async (): Promise<void> => {
            const status = await getImportJobStatus(jobId);
            if (cancelled) return;
            if (status) setJobStatus(status);
            if (
                status &&
                (status.status === 'completed' || status.status === 'failed')
            ) {
                onJobCreated?.();
                return;
            }
            timer = setTimeout(() => {
                void tick();
            }, POLL_INTERVAL_MS);
        };
        void tick();
        return (): void => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [jobId, onJobCreated]);

    /* ─── handlers ──────────────────────────────────────────────── */

    const handleFileChange = React.useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setError(null);
            setParseResult(null);
            setMapping({});
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) {
                setError('File is too large (max 5 MB).');
                return;
            }
            setIsParsing(true);
            try {
                const b64 = await readFileAsBase64(f);
                setFileBase64(b64);
                const res = await parseImportFile(entityType, b64);
                if (!res.ok) {
                    setError(res.error ?? 'Failed to parse file.');
                    return;
                }
                setParseResult(res);
                const sch = ENTITY_SCHEMAS[entityType];
                if (sch && res.headers) {
                    setMapping(autoDetectMapping(sch, res.headers));
                }
                setStep('map');
            } catch (err) {
                setError((err as Error).message || 'Failed to read file.');
            } finally {
                setIsParsing(false);
            }
        },
        [entityType],
    );

    const handleAutoDetect = React.useCallback(() => {
        if (!schema || !parseResult?.headers) return;
        setMapping(autoDetectMapping(schema, parseResult.headers));
    }, [schema, parseResult]);

    const handleMappingChange = React.useCallback(
        (fieldName: string, header: string) => {
            setMapping((prev) => {
                const next = { ...prev };
                if (header === '__none__') delete next[fieldName];
                else next[fieldName] = header;
                return next;
            });
        },
        [],
    );

    const handleSubmit = React.useCallback(async () => {
        if (!schema || !file) return;
        // Verify every required field is mapped.
        const missing = schema.fields
            .filter((f) => f.required && !mapping[f.name])
            .map((f) => f.label);
        if (missing.length > 0) {
            setError(`Map every required field: ${missing.join(', ')}`);
            return;
        }

        // Pre-flight validation checks
        if (parseResult?.sampleRows && parseResult.sampleRows.length > 0) {
            for (const field of schema.fields) {
                const header = mapping[field.name];
                if (!header) continue;

                // Check email format
                if (field.name.toLowerCase().includes('email')) {
                    const invalid = parseResult.sampleRows.find(r => r[header] && !r[header].includes('@'));
                    if (invalid) {
                        setError(`Pre-flight validation failed: "${invalid[header]}" does not look like a valid email for ${field.label}.`);
                        return;
                    }
                }
            }
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const res = await createImportJob({
                entityType,
                filename: file.name,
                fileBase64,
                columnMapping: mapping,
            });
            if (!res.ok || !res.jobId) {
                setError(res.error ?? 'Failed to start import.');
                return;
            }
            setJobId(res.jobId);
            setStep('progress');
            onJobCreated?.();
        } finally {
            setIsSubmitting(false);
        }
    }, [schema, file, entityType, fileBase64, mapping, onJobCreated]);

    const handleBackToPick = React.useCallback(() => {
        setStep('pick');
        setError(null);
    }, []);

    /* ─── rendering ─────────────────────────────────────────────── */

    return (
        <div className="flex w-full flex-col gap-4">
            <StepIndicator current={step} />

            {step === 'pick' && (
                <PickStep
                    entityType={entityType}
                    onEntityTypeChange={setEntityType}
                    file={file}
                    isParsing={isParsing}
                    error={error}
                    onFileChange={handleFileChange}
                />
            )}

            {step === 'map' && schema && parseResult?.headers && (
                <MapStep
                    schema={schema}
                    headers={parseResult.headers}
                    sampleRows={parseResult.sampleRows ?? []}
                    totalRows={parseResult.totalRows ?? 0}
                    mapping={mapping}
                    error={error}
                    isSubmitting={isSubmitting}
                    onMappingChange={handleMappingChange}
                    onAutoDetect={handleAutoDetect}
                    onBack={handleBackToPick}
                    onSubmit={handleSubmit}
                />
            )}

            {step === 'progress' && (
                <ProgressStep
                    jobStatus={jobStatus}
                    showAllErrors={showAllErrors}
                    onToggleErrors={() => setShowAllErrors((v) => !v)}
                    onClose={onClose}
                />
            )}
        </div>
    );
}

/* ─── step indicator ──────────────────────────────────────────────── */

function StepIndicator({ current }: { current: WizardStep }): React.ReactElement {
    const steps: { id: WizardStep; label: string }[] = [
        { id: 'pick', label: 'Choose & upload' },
        { id: 'map', label: 'Map columns' },
        { id: 'progress', label: 'Import' },
    ];
    const currentIndex = steps.findIndex((s) => s.id === current);
    return (
        <ol className="flex items-center gap-1 text-[12.5px]">
            {steps.map((s, i) => {
                const isDone = i < currentIndex;
                const isActive = i === currentIndex;
                return (
                    <React.Fragment key={s.id}>
                        <li
                            className={
                                'flex items-center gap-2 rounded-full border px-3 py-1 ' +
                                (isActive
                                    ? 'border-[var(--st-accent)] bg-[var(--st-accent)]/10 text-[var(--st-text)]'
                                    : isDone
                                      ? 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]'
                                      : 'border-[var(--st-border)] text-[var(--st-text-secondary)]')
                            }
                        >
                            <span
                                className={
                                    'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ' +
                                    (isActive || isDone
                                        ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                                        : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]')
                                }
                            >
                                {isDone ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                            </span>
                            {s.label}
                        </li>
                        {i < steps.length - 1 && (
                            <li
                                className="h-px w-4 bg-[var(--st-border)]"
                                aria-hidden="true"
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </ol>
    );
}

/* ─── step 1: pick + upload ───────────────────────────────────────── */

interface PickStepProps {
    entityType: string;
    onEntityTypeChange: (v: string) => void;
    file: File | null;
    isParsing: boolean;
    error: string | null;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function PickStep({
    entityType,
    onEntityTypeChange,
    file,
    isParsing,
    error,
    onFileChange,
}: PickStepProps): React.ReactElement {
    const schema = ENTITY_SCHEMAS[entityType];
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="import-entity">What are you importing?</Label>
                <Select value={entityType} onValueChange={onEntityTypeChange}>
                    <SelectTrigger id="import-entity">
                        <SelectValue placeholder="Pick an entity" />
                    </SelectTrigger>
                    <SelectContent>
                        {ENTITIES.map((e) => (
                            <SelectItem key={e.entityType} value={e.entityType}>
                                {e.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {schema && (
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                        {schema.description}
                    </p>
                )}
            </div>

            <Card className="flex flex-col items-start gap-3 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                    <UploadCloud className="h-4 w-4 text-[var(--st-accent)]" />
                    Upload a CSV or Excel file
                </div>
                <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                    First row should be a header. Max 5 MB. Supported formats:
                    .csv, .xlsx, .xls.
                </p>
                <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={onFileChange}
                    disabled={isParsing}
                />
                {file && (
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                        Selected: <span className="text-[var(--st-text)]">{file.name}</span> (
                        {(file.size / 1024).toFixed(1)} KB)
                    </p>
                )}
                {isParsing && (
                    <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Parsing file…
                    </div>
                )}
            </Card>

            {schema && (
                <Card className="p-4">
                    <p className="text-[12.5px] font-medium text-[var(--st-text)]">
                        Expected fields for {schema.label}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {schema.fields.map((f) => (
                            <Badge
                                key={f.name}
                                variant={f.required ? 'default' : 'secondary'}
                            >
                                {f.label}
                                {f.required ? ' *' : ''}
                            </Badge>
                        ))}
                    </div>
                </Card>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not parse file</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}

/* ─── step 2: map columns ─────────────────────────────────────────── */

interface MapStepProps {
    schema: EntitySchema;
    headers: string[];
    sampleRows: Record<string, string>[];
    totalRows: number;
    mapping: Record<string, string>;
    error: string | null;
    isSubmitting: boolean;
    onMappingChange: (fieldName: string, header: string) => void;
    onAutoDetect: () => void;
    onBack: () => void;
    onSubmit: () => void;
}

function MapStep({
    schema,
    headers,
    sampleRows,
    totalRows,
    mapping,
    error,
    isSubmitting,
    onMappingChange,
    onAutoDetect,
    onBack,
    onSubmit,
}: MapStepProps): React.ReactElement {
    const mappedCount = schema.fields.filter((f) => mapping[f.name]).length;
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-medium text-[var(--st-text)]">
                        Map columns to {schema.label} fields
                    </p>
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                        {totalRows.toLocaleString()} rows detected ·{' '}
                        {mappedCount}/{schema.fields.length} fields mapped
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={onAutoDetect}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Auto-detect
                </Button>
            </div>

            <Card className="overflow-hidden">
                <Table>
                    <THead>
                        <Tr>
                            <Th className="w-[40%]">Field</Th>
                            <Th className="w-[35%]">
                                Mapped column
                            </Th>
                            <Th>Type</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {schema.fields.map((field) => (
                            <FieldMappingRow
                                key={field.name}
                                field={field}
                                headers={headers}
                                value={mapping[field.name] ?? '__none__'}
                                onChange={(v) => onMappingChange(field.name, v)}
                            />
                        ))}
                    </TBody>
                </Table>
            </Card>

            {sampleRows.length > 0 && (
                <Card className="overflow-hidden">
                    <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-2 text-[12.5px] font-medium text-[var(--st-text)]">
                        Preview (first {Math.min(sampleRows.length, 5)} rows after
                        mapping)
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <THead>
                                <Tr>
                                    {schema.fields
                                        .filter((f) => mapping[f.name])
                                        .map((f) => (
                                            <Th key={f.name}>
                                                {f.label}
                                            </Th>
                                        ))}
                                </Tr>
                            </THead>
                            <TBody>
                                {sampleRows.slice(0, 5).map((row, idx) => (
                                    <Tr key={idx}>
                                        {schema.fields
                                            .filter((f) => mapping[f.name])
                                            .map((f) => {
                                                const header = mapping[f.name];
                                                const cell = header ? row[header] : '';
                                                return (
                                                    <Td
                                                        key={f.name}
                                                        className="max-w-[200px] truncate text-[12.5px] text-[var(--st-text-secondary)]"
                                                    >
                                                        {cell || '—'}
                                                    </Td>
                                                );
                                            })}
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>
                </Card>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Cannot start import</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    Back
                </Button>
                <Button onClick={onSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Starting…
                        </>
                    ) : (
                        <>Start import</>
                    )}
                </Button>
            </div>
        </div>
    );
}

function FieldMappingRow({
    field,
    headers,
    value,
    onChange,
}: {
    field: ImportField;
    headers: string[];
    value: string;
    onChange: (v: string) => void;
}): React.ReactElement {
    return (
        <Tr>
            <Td>
                <div className="flex flex-col">
                    <span className="text-[12.5px] font-medium text-[var(--st-text)]">
                        {field.label}
                        {field.required && (
                            <span className="ml-1 text-[var(--st-danger)]">*</span>
                        )}
                    </span>
                    <span className="text-[11px] text-[var(--st-text-secondary)]">
                        {field.name}
                        {field.example ? ` · e.g. ${field.example}` : ''}
                    </span>
                </div>
            </Td>
            <Td>
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger className="h-8">
                        <SelectValue placeholder="— skip —" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">— skip —</SelectItem>
                        {headers.map((h) => (
                            <SelectItem key={h} value={h}>
                                {h}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Td>
            <Td>
                <Badge variant="outline" className="text-[10.5px]">
                    {field.type}
                </Badge>
            </Td>
        </Tr>
    );
}

/* ─── step 3: progress ────────────────────────────────────────────── */

interface ProgressStepProps {
    jobStatus: ImportJobStatus | null;
    showAllErrors: boolean;
    onToggleErrors: () => void;
    onClose?: () => void;
}

function ProgressStep({
    jobStatus,
    showAllErrors,
    onToggleErrors,
    onClose,
}: ProgressStepProps): React.ReactElement {
    if (!jobStatus) {
        return (
            <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting import…
            </div>
        );
    }

    const pct =
        jobStatus.totalRows > 0
            ? Math.min(100, (jobStatus.processed / jobStatus.totalRows) * 100)
            : 0;
    const isDone = jobStatus.status === 'completed';
    const isFailed = jobStatus.status === 'failed';
    const visibleErrors = showAllErrors
        ? jobStatus.errors
        : jobStatus.errors.slice(0, 10);

    return (
        <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {isDone ? (
                            <CheckCircle2 className="h-5 w-5 text-[var(--st-status-ok)]" />
                        ) : isFailed ? (
                            <XCircle className="h-5 w-5 text-[var(--st-danger)]" />
                        ) : (
                            <Loader2 className="h-5 w-5 animate-spin text-[var(--st-accent)]" />
                        )}
                        <div>
                            <p className="text-sm font-medium text-[var(--st-text)]">
                                {isDone
                                    ? 'Import complete'
                                    : isFailed
                                      ? 'Import failed'
                                      : 'Importing…'}
                            </p>
                            <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                {jobStatus.filename}
                            </p>
                        </div>
                    </div>
                    <Badge variant={isDone ? 'default' : isFailed ? 'destructive' : 'secondary'}>
                        {jobStatus.status}
                    </Badge>
                </div>

                <Progress value={pct} />

                <div className="grid grid-cols-3 gap-3 text-[12.5px]">
                    <div>
                        <p className="text-[var(--st-text-secondary)]">Processed</p>
                        <p className="text-sm font-medium text-[var(--st-text)]">
                            {jobStatus.processed.toLocaleString()} /{' '}
                            {jobStatus.totalRows.toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-[var(--st-text-secondary)]">Succeeded</p>
                        <p className="text-sm font-medium text-[var(--st-status-ok)]">
                            {jobStatus.succeeded.toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-[var(--st-text-secondary)]">Failed</p>
                        <p
                            className={
                                jobStatus.failed > 0
                                    ? 'text-sm font-medium text-[var(--st-danger)]'
                                    : 'text-sm font-medium text-[var(--st-text)]'
                            }
                        >
                            {jobStatus.failed.toLocaleString()}
                        </p>
                    </div>
                </div>
            </Card>

            {jobStatus.errors.length > 0 && (
                <Card className="overflow-hidden">
                    <button
                        type="button"
                        onClick={onToggleErrors}
                        className="flex w-full items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-2 text-left text-[12.5px] font-medium text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                    >
                        <span>
                            {jobStatus.errors.length} row error
                            {jobStatus.errors.length === 1 ? '' : 's'}
                        </span>
                        <div className="flex items-center gap-3">
                            <a href={`/api/import-jobs/${jobId}/errors`} className="text-[var(--st-accent)] hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Download className="h-3.5 w-3.5" />
                                Download log
                            </a>
                            <span className="text-[var(--st-text-secondary)]">
                                {showAllErrors ? 'Show less' : 'Show all'}
                            </span>
                        </div>
                    </button>
                    <Table>
                        <THead>
                            <Tr>
                                <Th className="w-24">Row</Th>
                                <Th>Error</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {visibleErrors.map((e, i) => (
                                <Tr key={`${e.row}-${i}`}>
                                    <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {e.row}
                                    </Td>
                                    <Td className="text-[12.5px] text-[var(--st-text)]">
                                        {e.message}
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            )}

            <div className="flex items-center justify-end gap-2">
                {!isDone && !isFailed && (
                    <Button variant="outline" onClick={onClose}>
                        Run in background
                    </Button>
                )}
                {(isDone || isFailed) && (
                    <Button onClick={onClose}>Close</Button>
                )}
            </div>
        </div>
    );
}
