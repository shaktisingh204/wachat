'use client';

import * as React from 'react';
import { Play, Save, Workflow, ArrowLeft, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';

import {
    Button,
    Input,
    Badge,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/sabcrm/20ui';
import {
    previewRecipe,
    runRecipe,
    updateRecipe,
    computeProfile,
    stepFromSuggestion,
    persistDataset,
    getDatasetPreview,
} from '@/app/actions/sabprep.actions';
import type { DataprepRecipeDoc } from '@/lib/rust-client/sabprep-recipes';
import type {
    Row,
    Step,
    StepRunSummary,
} from '@/lib/rust-client/sabprep-steps';
import type { ColumnProfile } from '@/lib/rust-client/sabprep-profiles';

import { SourcePreviewPanel } from './source-preview-panel';
import { StepStack } from './step-stack';
import { OutputPreviewPanel } from './output-preview-panel';
import { ColumnProfilerPanel } from './column-profiler-panel';
import { CsvUploadButton } from './csv-upload-button';

const PREVIEW_LIMIT = 50;

interface Props {
    recipe: DataprepRecipeDoc;
    datasets: Array<{ id: string; name: string; rowsCount: number; createdAt: string }>;
    sourcePreview: { rows: Row[]; name: string; rowsCount: number } | null;
}

export function RecipeCanvasClient({ recipe, datasets: initialDatasets, sourcePreview: initialSource }: Props) {
    const [name, setName] = React.useState(recipe.name);
    const [steps, setSteps] = React.useState<Step[]>(recipe.steps ?? []);
    const [datasets, setDatasets] = React.useState(initialDatasets);
    const [sourceId, setSourceId] = React.useState<string | undefined>(
        recipe.sourceDatasetId,
    );
    const [sourceRows, setSourceRows] = React.useState<Row[]>(initialSource?.rows ?? []);
    const [outputRows, setOutputRows] = React.useState<Row[]>([]);
    const [summaries, setSummaries] = React.useState<StepRunSummary[]>([]);
    const [profiles, setProfiles] = React.useState<ColumnProfile[]>([]);
    const [busy, setBusy] = React.useState(false);
    const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

    // Compute profiles whenever source rows change.
    React.useEffect(() => {
        if (sourceRows.length === 0) {
            setProfiles([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const p = await computeProfile(sourceRows.slice(0, 500));
                if (!cancelled) setProfiles(p);
            } catch (e) {
                console.error('computeProfile failed', e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [sourceRows]);

    // Re-run preview whenever steps or rows change.
    const refreshPreview = React.useCallback(async () => {
        if (sourceRows.length === 0) {
            setOutputRows([]);
            setSummaries([]);
            return;
        }
        try {
            const res = await previewRecipe({
                rows: sourceRows,
                steps,
                limit: PREVIEW_LIMIT,
            });
            setOutputRows(res.rows);
            setSummaries(res.summaries);
        } catch (e) {
            console.error('previewRecipe failed', e);
        }
    }, [sourceRows, steps]);

    React.useEffect(() => {
        refreshPreview();
    }, [refreshPreview]);

    const onSave = React.useCallback(async () => {
        setBusy(true);
        setStatusMsg(null);
        try {
            await updateRecipe(String(recipe._id), {
                name,
                steps,
                sourceDatasetId: sourceId ?? '',
                sourceColumns:
                    sourceRows.length > 0 ? Object.keys(sourceRows[0]) : undefined,
            });
            setStatusMsg('Saved.');
        } catch (e) {
            setStatusMsg(`Save failed: ${String(e)}`);
        } finally {
            setBusy(false);
        }
    }, [recipe._id, name, steps, sourceId, sourceRows]);

    const onRun = React.useCallback(async () => {
        setBusy(true);
        setStatusMsg(null);
        try {
            // Save first so the persisted recipe matches what we run.
            await updateRecipe(String(recipe._id), {
                name,
                steps,
                sourceDatasetId: sourceId ?? '',
            });
            const res = await runRecipe(String(recipe._id), {
                rows: sourceId ? undefined : sourceRows,
                persistOutput: true,
            });
            setStatusMsg(
                `Run ${res.status}, ${res.rowsIn} to ${res.rowsOut} rows (run ${res.runId}).`,
            );
        } catch (e) {
            setStatusMsg(`Run failed: ${String(e)}`);
        } finally {
            setBusy(false);
        }
    }, [recipe._id, name, steps, sourceId, sourceRows]);

    const onUploadedCsv = React.useCallback(
        async (parsed: { name: string; rows: Row[] }) => {
            setBusy(true);
            try {
                const res = await persistDataset({ name: parsed.name, rows: parsed.rows });
                setDatasets((prev) => [
                    { id: res.id, name: res.name, rowsCount: res.rowsCount, createdAt: new Date().toISOString() },
                    ...prev,
                ]);
                setSourceId(res.id);
                setSourceRows(parsed.rows.slice(0, 500));
            } finally {
                setBusy(false);
            }
        },
        [],
    );

    const onPickSource = React.useCallback(async (id: string) => {
        setSourceId(id);
        if (!id) {
            setSourceRows([]);
            return;
        }
        try {
            const preview = await getDatasetPreview(id, 500);
            setSourceRows(preview.rows);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const onAddSuggestionStep = React.useCallback(
        async (column: string, kind: string) => {
            const newStep = await stepFromSuggestion(column, kind);
            setSteps((prev) => [...prev, newStep]);
        },
        [],
    );

    const sourceColumns = React.useMemo(
        () => (sourceRows.length > 0 ? Object.keys(sourceRows[0]) : []),
        [sourceRows],
    );

    const status = classifyStatus(statusMsg);
    const hasSource = sourceRows.length > 0;

    return (
        <div className="20ui flex h-full flex-col">
            <header className="flex flex-col gap-3 border-b border-[var(--st-border)] px-4 py-3 md:px-6">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/dashboard/sabprep" aria-label="Back to recipes">
                            <ArrowLeft size={16} aria-hidden="true" />
                        </Link>
                    </Button>
                    <span
                        aria-hidden="true"
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                    >
                        <Workflow size={16} />
                    </span>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-label="Recipe name"
                        className="max-w-md text-base font-medium"
                    />
                    <Badge tone="neutral" kind="outline">
                        {steps.length} step{steps.length === 1 ? '' : 's'}
                    </Badge>
                    {hasSource ? (
                        <Badge tone="success" dot>
                            Source ready
                        </Badge>
                    ) : (
                        <Badge tone="warning" dot>
                            No source
                        </Badge>
                    )}

                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        {status ? (
                            <span
                                className={`inline-flex items-center gap-1.5 text-xs ${
                                    status.tone === 'danger'
                                        ? 'text-[var(--st-danger)]'
                                        : status.tone === 'success'
                                          ? 'text-[var(--st-success)]'
                                          : 'text-[var(--st-text-secondary)]'
                                }`}
                                role="status"
                            >
                                {status.tone === 'danger' ? (
                                    <AlertTriangle size={13} aria-hidden="true" />
                                ) : status.tone === 'success' ? (
                                    <CheckCircle2 size={13} aria-hidden="true" />
                                ) : (
                                    <Loader2 size={13} aria-hidden="true" />
                                )}
                                {statusMsg}
                            </span>
                        ) : null}
                        <Button variant="outline" iconLeft={Save} onClick={onSave} disabled={busy}>
                            Save
                        </Button>
                        <Button
                            variant="primary"
                            iconLeft={Play}
                            onClick={onRun}
                            disabled={busy || !hasSource}
                        >
                            Run recipe
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <SourceDatasetPicker
                        datasets={datasets}
                        value={sourceId}
                        onPick={onPickSource}
                    />
                    <CsvUploadButton onParsed={onUploadedCsv} />
                </div>
            </header>

            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-4">
                {/* Left, source preview + profiler */}
                <section aria-label="Source" className="col-span-12 lg:col-span-4 overflow-auto">
                    <SourcePreviewPanel rows={sourceRows} />
                    <div className="mt-4">
                        <ColumnProfilerPanel
                            profiles={profiles}
                            onAddSuggestion={onAddSuggestionStep}
                        />
                    </div>
                </section>

                {/* Center, step stack */}
                <section aria-label="Steps" className="col-span-12 lg:col-span-4 overflow-auto">
                    <StepStack
                        steps={steps}
                        columns={sourceColumns}
                        datasets={datasets.filter((d) => d.id !== sourceId)}
                        summaries={summaries}
                        onChange={setSteps}
                    />
                </section>

                {/* Right, output preview */}
                <section aria-label="Output" className="col-span-12 lg:col-span-4 overflow-auto">
                    <OutputPreviewPanel rows={outputRows} summaries={summaries} />
                </section>
            </div>
        </div>
    );
}

/** Map a free-text status line to a tone for the inline indicator. */
function classifyStatus(
    msg: string | null,
): { tone: 'success' | 'danger' | 'neutral' } | null {
    if (!msg) return null;
    const lower = msg.toLowerCase();
    if (lower.includes('fail')) return { tone: 'danger' };
    if (lower.startsWith('saved') || lower.startsWith('run ')) return { tone: 'success' };
    return { tone: 'neutral' };
}

const NO_SOURCE = '__none__';

function SourceDatasetPicker({
    datasets,
    value,
    onPick,
}: {
    datasets: Array<{ id: string; name: string; rowsCount: number }>;
    value?: string;
    onPick: (id: string) => void;
}) {
    return (
        <Select
            value={value && value.length > 0 ? value : NO_SOURCE}
            onValueChange={(v) => onPick(v === NO_SOURCE ? '' : v)}
        >
            <SelectTrigger aria-label="Source dataset" className="w-64">
                <SelectValue placeholder="Pick source dataset" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NO_SOURCE}>Pick source dataset</SelectItem>
                {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.rowsCount} rows)
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
