'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, Trash2, Plus, EyeOff, Eye } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardBody, Button, Badge, EmptyState } from '@/components/sabcrm/20ui';
import { STEP_CATALOG, type Step, type StepKind, type StepRunSummary } from '@/lib/rust-client/sabprep-steps';
import { StepEditor } from './step-editor';

interface Props {
    steps: Step[];
    columns: string[];
    datasets: Array<{ id: string; name: string }>;
    summaries: StepRunSummary[];
    onChange: (next: Step[]) => void;
}

export function StepStack({ steps, columns, datasets, summaries, onChange }: Props) {
    const addStep = React.useCallback(
        (kind: StepKind) => {
            onChange([...steps, makeBlankStep(kind, columns)]);
        },
        [steps, onChange, columns],
    );

    const updateAt = React.useCallback(
        (idx: number, next: Step) => {
            const copy = steps.slice();
            copy[idx] = next;
            onChange(copy);
        },
        [steps, onChange],
    );

    const moveUp = React.useCallback(
        (idx: number) => {
            if (idx === 0) return;
            const copy = steps.slice();
            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
            onChange(copy);
        },
        [steps, onChange],
    );

    const moveDown = React.useCallback(
        (idx: number) => {
            if (idx >= steps.length - 1) return;
            const copy = steps.slice();
            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
            onChange(copy);
        },
        [steps, onChange],
    );

    const remove = React.useCallback(
        (idx: number) => {
            onChange(steps.filter((_, i) => i !== idx));
        },
        [steps, onChange],
    );

    const toggleDisabled = React.useCallback(
        (idx: number) => {
            const copy = steps.slice();
            copy[idx] = { ...copy[idx], disabled: !copy[idx].disabled };
            onChange(copy);
        },
        [steps, onChange],
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">Steps</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
                {steps.length === 0 ? (
                    <EmptyState
                        icon={<Plus className="h-5 w-5" />}
                        title="No steps yet"
                        description="Add a step below to start transforming the source dataset."
                    />
                ) : (
                    steps.map((step, idx) => {
                        const summary = summaries.find((s) => s.stepIndex === idx);
                        return (
                            <Card key={step.id ?? idx} className="border-dashed">
                                <CardHeader className="flex flex-row items-center justify-between gap-2 py-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">#{idx + 1}</Badge>
                                        <span className="text-sm font-medium">
                                            {labelForKind(step.kind)}
                                        </span>
                                        {summary ? (
                                            <Badge variant="secondary">
                                                {summary.rowsIn} → {summary.rowsOut}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => toggleDisabled(idx)}
                                            aria-label={step.disabled ? 'Enable step' : 'Disable step'}
                                        >
                                            {step.disabled ? (
                                                <EyeOff className="h-3.5 w-3.5" />
                                            ) : (
                                                <Eye className="h-3.5 w-3.5" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => moveUp(idx)}
                                            disabled={idx === 0}
                                            aria-label="Move up"
                                        >
                                            <ChevronUp className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => moveDown(idx)}
                                            disabled={idx === steps.length - 1}
                                            aria-label="Move down"
                                        >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => remove(idx)}
                                            aria-label="Delete step"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardBody>
                                    <StepEditor
                                        step={step}
                                        columns={columns}
                                        datasets={datasets}
                                        onChange={(next) => updateAt(idx, next)}
                                    />
                                </CardBody>
                            </Card>
                        );
                    })
                )}

                <AddStepBar onAdd={addStep} />
            </CardBody>
        </Card>
    );
}

function AddStepBar({ onAdd }: { onAdd: (kind: StepKind) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs opacity-70">Add step:</span>
            {STEP_CATALOG.map((s) => (
                <Button
                    key={s.kind}
                    size="sm"
                    variant="outline"
                    onClick={() => onAdd(s.kind)}
                    title={s.description}
                >
                    {s.label}
                </Button>
            ))}
        </div>
    );
}

function labelForKind(kind: StepKind): string {
    return STEP_CATALOG.find((s) => s.kind === kind)?.label ?? kind;
}

function makeBlankStep(kind: StepKind, columns: string[]): Step {
    const c0 = columns[0] ?? '';
    switch (kind) {
        case 'filter':
            return { kind, config: { column: c0, operator: 'equals', value: '' } };
        case 'rename':
            return { kind, config: { from: c0, to: c0 } };
        case 'derive':
            return { kind, config: { target: 'new_column', expression: `{${c0}}` } };
        case 'split':
            return { kind, config: { column: c0, delimiter: ',', into: ['part1', 'part2'] } };
        case 'replace':
            return { kind, config: { column: c0, find: '', replace: '' } };
        case 'deduplicate':
            return { kind, config: { subset: [] } };
        case 'fillNulls':
            return { kind, config: { column: c0, fillWith: '' } };
        case 'typeCast':
            return { kind, config: { column: c0, targetType: 'string' } };
        case 'join':
            return {
                kind,
                config: {
                    rightDatasetId: '',
                    on: [{ left: c0, right: c0 }],
                    joinType: 'inner',
                },
            };
        case 'union':
            return { kind, config: { otherDatasetId: '' } };
        case 'aggregate':
            return {
                kind,
                config: {
                    groupBy: [c0],
                    aggregations: [{ column: c0, func: 'count', output: 'count' }],
                },
            };
        case 'pivot':
            return {
                kind,
                config: {
                    pivotColumn: c0,
                    valueColumn: c0,
                    indexColumns: [],
                    aggFunc: 'sum',
                },
            };
        case 'unpivot':
            return {
                kind,
                config: {
                    valueColumns: columns.slice(0, 2),
                    varName: 'variable',
                    valueName: 'value',
                    idColumns: [],
                },
            };
    }
}
