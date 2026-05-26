'use client';

import * as React from 'react';
import { Play, Save } from 'lucide-react';

import {
    Button,
    Card,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardContent,
    Input,
    Badge,
} from '@/components/zoruui';
import {
    previewRecipe,
    runRecipe,
    updateRecipe,
    computeProfile,
    stepFromSuggestion,
    persistDataset,
    getDatasetPreview,
} from '@/app/actions/sabprep.actions';
import type { DataprepRecipeDoc } from '@/lib/rust-client/dataprep-recipes';
import type {
    Row,
    Step,
    StepRunSummary,
} from '@/lib/rust-client/dataprep-steps';
import type { ColumnProfile } from '@/lib/rust-client/dataprep-profiles';

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
                `Run ${res.status} — ${res.rowsIn} → ${res.rowsOut} rows (run ${res.runId}).`,
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

    return (
        <div className="zoruui flex h-full flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b border-[var(--zoru-border,#e5e7eb)] px-6 py-4">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="max-w-md text-base font-medium"
                />
                <Badge variant="outline">{steps.length} step(s)</Badge>
                <SourceDatasetPicker
                    datasets={datasets}
                    value={sourceId}
                    onPick={onPickSource}
                />
                <CsvUploadButton onParsed={onUploadedCsv} />
                <div className="ml-auto flex items-center gap-2">
                    {statusMsg ? (
                        <span className="text-xs opacity-70">{statusMsg}</span>
                    ) : null}
                    <Button variant="outline" onClick={onSave} disabled={busy}>
                        <Save className="h-4 w-4" /> Save
                    </Button>
                    <Button onClick={onRun} disabled={busy || sourceRows.length === 0}>
                        <Play className="h-4 w-4" /> Run recipe
                    </Button>
                </div>
            </header>

            <div className="grid flex-1 grid-cols-12 gap-4 overflow-hidden p-4">
                {/* Left — source preview */}
                <div className="col-span-12 lg:col-span-4 overflow-auto">
                    <SourcePreviewPanel rows={sourceRows} />
                    <div className="mt-4">
                        <ColumnProfilerPanel
                            profiles={profiles}
                            onAddSuggestion={onAddSuggestionStep}
                        />
                    </div>
                </div>

                {/* Center — step stack */}
                <div className="col-span-12 lg:col-span-4 overflow-auto">
                    <StepStack
                        steps={steps}
                        columns={sourceColumns}
                        datasets={datasets.filter((d) => d.id !== sourceId)}
                        summaries={summaries}
                        onChange={setSteps}
                    />
                </div>

                {/* Right — output preview */}
                <div className="col-span-12 lg:col-span-4 overflow-auto">
                    <OutputPreviewPanel rows={outputRows} summaries={summaries} />
                </div>
            </div>
        </div>
    );
}

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
        <select
            className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
            value={value ?? ''}
            onChange={(e) => onPick(e.target.value)}
            aria-label="Source dataset"
        >
            <option value="">— pick source dataset —</option>
            {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                    {d.name} ({d.rowsCount} rows)
                </option>
            ))}
        </select>
    );
}
