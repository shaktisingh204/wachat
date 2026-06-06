'use client';

import * as React from 'react';
import { Input, Textarea, Label, Button, Badge } from '@/components/sabcrm/20ui/compat';
import type {
    AggregateFunc,
    CastType,
    FilterOperator,
    JoinKey,
    JoinType,
    Step,
} from '@/lib/rust-client/sabprep-steps';

interface Props {
    step: Step;
    columns: string[];
    datasets: Array<{ id: string; name: string }>;
    onChange: (next: Step) => void;
}

export function StepEditor({ step, columns, datasets, onChange }: Props) {
    switch (step.kind) {
        case 'filter':
            return (
                <FilterEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'rename':
            return (
                <RenameEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'derive':
            return (
                <DeriveEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'split':
            return (
                <SplitEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'replace':
            return (
                <ReplaceEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'deduplicate':
            return (
                <DedupeEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'fillNulls':
            return (
                <FillNullsEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'typeCast':
            return (
                <TypeCastEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'join':
            return (
                <JoinEditor
                    step={step}
                    columns={columns}
                    datasets={datasets}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'union':
            return (
                <UnionEditor
                    step={step}
                    datasets={datasets}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'aggregate':
            return (
                <AggregateEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'pivot':
            return (
                <PivotEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
        case 'unpivot':
            return (
                <UnpivotEditor
                    step={step}
                    columns={columns}
                    onChange={(c) => onChange({ ...step, config: c })}
                />
            );
    }
}

/* ─── Sub-editors ─────────────────────────────────────────────────── */

const FILTER_OPS: FilterOperator[] = [
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'gt',
    'gte',
    'lt',
    'lte',
    'is_null',
    'is_not_null',
];

const CAST_TYPES: CastType[] = ['string', 'number', 'integer', 'bool'];
const JOIN_TYPES: JoinType[] = ['inner', 'left', 'right', 'outer'];
const AGG_FUNCS: AggregateFunc[] = ['count', 'sum', 'avg', 'min', 'max', 'count_distinct'];

function ColumnPicker({
    value,
    columns,
    onChange,
    label = 'Column',
}: {
    value: string;
    columns: string[];
    onChange: (s: string) => void;
    label?: string;
}) {
    return (
        <div className="grid gap-1">
            <Label className="text-xs">{label}</Label>
            <select
                className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">— select —</option>
                {columns.map((c) => (
                    <option key={c} value={c}>
                        {c}
                    </option>
                ))}
            </select>
        </div>
    );
}

function FilterEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'filter' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'filter' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <ColumnPicker
                value={config.column}
                columns={columns}
                onChange={(v) => onChange({ ...config, column: v })}
            />
            <div className="grid gap-1">
                <Label className="text-xs">Operator</Label>
                <select
                    className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
                    value={config.operator}
                    onChange={(e) => onChange({ ...config, operator: e.target.value as FilterOperator })}
                >
                    {FILTER_OPS.map((o) => (
                        <option key={o} value={o}>
                            {o.replace(/_/g, ' ')}
                        </option>
                    ))}
                </select>
            </div>
            <div className="grid gap-1">
                <Label className="text-xs">Value</Label>
                <Input
                    value={typeof config.value === 'object' ? '' : String(config.value ?? '')}
                    onChange={(e) => onChange({ ...config, value: e.target.value })}
                    placeholder="value"
                />
            </div>
        </div>
    );
}

function RenameEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'rename' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'rename' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid grid-cols-2 gap-2">
            <ColumnPicker
                label="From"
                value={config.from}
                columns={columns}
                onChange={(v) => onChange({ ...config, from: v })}
            />
            <div className="grid gap-1">
                <Label className="text-xs">To</Label>
                <Input
                    value={config.to}
                    onChange={(e) => onChange({ ...config, to: e.target.value })}
                />
            </div>
        </div>
    );
}

function DeriveEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'derive' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'derive' }>['config']) => void;
}) {
    const { config } = step;
    const insertColumn = (c: string) => {
        onChange({ ...config, expression: `${config.expression}{${c}}` });
    };
    return (
        <div className="grid gap-2">
            <div className="grid gap-1">
                <Label className="text-xs">Target column</Label>
                <Input
                    value={config.target}
                    onChange={(e) => onChange({ ...config, target: e.target.value })}
                />
            </div>
            <div className="grid gap-1">
                <Label className="text-xs">Expression</Label>
                <Textarea
                    value={config.expression}
                    onChange={(e) => onChange({ ...config, expression: e.target.value })}
                    placeholder="upper({first_name}) or concat({a},_,{b})"
                    rows={2}
                />
                <p className="text-[10px] opacity-60">
                    Helpers: <code>upper</code>, <code>lower</code>, <code>trim</code>, <code>concat</code>. Insert column:
                </p>
                <div className="flex flex-wrap gap-1">
                    {columns.map((c) => (
                        <Button
                            key={c}
                            size="sm"
                            variant="ghost"
                            onClick={() => insertColumn(c)}
                        >
                            {`{${c}}`}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SplitEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'split' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'split' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid gap-2">
            <ColumnPicker
                value={config.column}
                columns={columns}
                onChange={(v) => onChange({ ...config, column: v })}
            />
            <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                    <Label className="text-xs">Delimiter</Label>
                    <Input
                        value={config.delimiter}
                        onChange={(e) => onChange({ ...config, delimiter: e.target.value })}
                    />
                </div>
                <div className="grid gap-1">
                    <Label className="text-xs">Into (comma-separated)</Label>
                    <Input
                        value={(config.into ?? []).join(',')}
                        onChange={(e) =>
                            onChange({
                                ...config,
                                into: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                        }
                    />
                </div>
            </div>
        </div>
    );
}

function ReplaceEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'replace' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'replace' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid gap-2">
            <ColumnPicker
                value={config.column}
                columns={columns}
                onChange={(v) => onChange({ ...config, column: v })}
            />
            <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                    <Label className="text-xs">Find</Label>
                    <Input
                        value={config.find}
                        onChange={(e) => onChange({ ...config, find: e.target.value })}
                    />
                </div>
                <div className="grid gap-1">
                    <Label className="text-xs">Replace</Label>
                    <Input
                        value={config.replace}
                        onChange={(e) => onChange({ ...config, replace: e.target.value })}
                    />
                </div>
            </div>
        </div>
    );
}

function DedupeEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'deduplicate' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'deduplicate' }>['config']) => void;
}) {
    const { config } = step;
    const subset = config.subset ?? [];
    const toggle = (col: string) => {
        const has = subset.includes(col);
        onChange({
            subset: has ? subset.filter((c) => c !== col) : [...subset, col],
        });
    };
    return (
        <div className="grid gap-1">
            <Label className="text-xs">
                Compare on (empty = all columns)
            </Label>
            <div className="flex flex-wrap gap-1">
                {columns.map((c) => (
                    <Button
                        key={c}
                        size="sm"
                        variant={subset.includes(c) ? 'default' : 'outline'}
                        onClick={() => toggle(c)}
                    >
                        {c}
                    </Button>
                ))}
            </div>
        </div>
    );
}

function FillNullsEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'fillNulls' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'fillNulls' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid grid-cols-2 gap-2">
            <ColumnPicker
                value={config.column}
                columns={columns}
                onChange={(v) => onChange({ ...config, column: v })}
            />
            <div className="grid gap-1">
                <Label className="text-xs">Fill with</Label>
                <Input
                    value={String(config.fillWith ?? '')}
                    onChange={(e) => onChange({ ...config, fillWith: e.target.value })}
                />
            </div>
        </div>
    );
}

function TypeCastEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'typeCast' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'typeCast' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid grid-cols-2 gap-2">
            <ColumnPicker
                value={config.column}
                columns={columns}
                onChange={(v) => onChange({ ...config, column: v })}
            />
            <div className="grid gap-1">
                <Label className="text-xs">Cast to</Label>
                <select
                    className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
                    value={config.targetType}
                    onChange={(e) => onChange({ ...config, targetType: e.target.value as CastType })}
                >
                    {CAST_TYPES.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function JoinEditor({
    step,
    columns,
    datasets,
    onChange,
}: {
    step: Extract<Step, { kind: 'join' }>;
    columns: string[];
    datasets: Array<{ id: string; name: string }>;
    onChange: (c: Extract<Step, { kind: 'join' }>['config']) => void;
}) {
    const { config } = step;
    const setKey = (i: number, key: JoinKey) => {
        const copy = config.on.slice();
        copy[i] = key;
        onChange({ ...config, on: copy });
    };
    return (
        <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                    <Label className="text-xs">Right dataset</Label>
                    <select
                        className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
                        value={config.rightDatasetId}
                        onChange={(e) => onChange({ ...config, rightDatasetId: e.target.value })}
                    >
                        <option value="">— select —</option>
                        {datasets.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="grid gap-1">
                    <Label className="text-xs">Join type</Label>
                    <select
                        className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
                        value={config.joinType ?? 'inner'}
                        onChange={(e) => onChange({ ...config, joinType: e.target.value as JoinType })}
                    >
                        {JOIN_TYPES.map((j) => (
                            <option key={j} value={j}>
                                {j}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <Label className="text-xs">Match on</Label>
            {config.on.map((k, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                    <ColumnPicker
                        label="Left"
                        value={k.left}
                        columns={columns}
                        onChange={(v) => setKey(i, { ...k, left: v })}
                    />
                    <div className="grid gap-1">
                        <Label className="text-xs">Right</Label>
                        <Input
                            value={k.right}
                            onChange={(e) => setKey(i, { ...k, right: e.target.value })}
                        />
                    </div>
                </div>
            ))}
            <Button
                size="sm"
                variant="outline"
                onClick={() =>
                    onChange({ ...config, on: [...config.on, { left: '', right: '' }] })
                }
            >
                Add key
            </Button>
        </div>
    );
}

function UnionEditor({
    step,
    datasets,
    onChange,
}: {
    step: Extract<Step, { kind: 'union' }>;
    datasets: Array<{ id: string; name: string }>;
    onChange: (c: Extract<Step, { kind: 'union' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid gap-1">
            <Label className="text-xs">Other dataset</Label>
            <select
                className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
                value={config.otherDatasetId}
                onChange={(e) => onChange({ ...config, otherDatasetId: e.target.value })}
            >
                <option value="">— select —</option>
                {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                        {d.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

function AggregateEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'aggregate' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'aggregate' }>['config']) => void;
}) {
    const { config } = step;
    const groupBy = config.groupBy ?? [];
    const toggleGroup = (c: string) => {
        onChange({
            ...config,
            groupBy: groupBy.includes(c)
                ? groupBy.filter((x) => x !== c)
                : [...groupBy, c],
        });
    };
    return (
        <div className="grid gap-2">
            <Label className="text-xs">Group by</Label>
            <div className="flex flex-wrap gap-1">
                {columns.map((c) => (
                    <Button
                        key={c}
                        size="sm"
                        variant={groupBy.includes(c) ? 'default' : 'outline'}
                        onClick={() => toggleGroup(c)}
                    >
                        {c}
                    </Button>
                ))}
            </div>
            <Label className="text-xs">Aggregations</Label>
            {config.aggregations.map((a, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                    <ColumnPicker
                        value={a.column}
                        columns={columns}
                        onChange={(v) => {
                            const copy = config.aggregations.slice();
                            copy[i] = { ...a, column: v };
                            onChange({ ...config, aggregations: copy });
                        }}
                    />
                    <div className="grid gap-1">
                        <Label className="text-xs">Func</Label>
                        <select
                            className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
                            value={a.func}
                            onChange={(e) => {
                                const copy = config.aggregations.slice();
                                copy[i] = { ...a, func: e.target.value as AggregateFunc };
                                onChange({ ...config, aggregations: copy });
                            }}
                        >
                            {AGG_FUNCS.map((f) => (
                                <option key={f} value={f}>
                                    {f}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-1">
                        <Label className="text-xs">Output as</Label>
                        <Input
                            value={a.output}
                            onChange={(e) => {
                                const copy = config.aggregations.slice();
                                copy[i] = { ...a, output: e.target.value };
                                onChange({ ...config, aggregations: copy });
                            }}
                        />
                    </div>
                </div>
            ))}
            <Button
                size="sm"
                variant="outline"
                onClick={() =>
                    onChange({
                        ...config,
                        aggregations: [
                            ...config.aggregations,
                            { column: columns[0] ?? '', func: 'count', output: 'count' },
                        ],
                    })
                }
            >
                Add aggregation
            </Button>
        </div>
    );
}

function PivotEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'pivot' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'pivot' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid grid-cols-2 gap-2">
            <ColumnPicker
                label="Pivot column"
                value={config.pivotColumn}
                columns={columns}
                onChange={(v) => onChange({ ...config, pivotColumn: v })}
            />
            <ColumnPicker
                label="Value column"
                value={config.valueColumn}
                columns={columns}
                onChange={(v) => onChange({ ...config, valueColumn: v })}
            />
            <div className="col-span-2 grid gap-1">
                <Label className="text-xs">Index columns (comma-separated)</Label>
                <Input
                    value={(config.indexColumns ?? []).join(',')}
                    onChange={(e) =>
                        onChange({
                            ...config,
                            indexColumns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                    }
                />
            </div>
            <div className="grid gap-1">
                <Label className="text-xs">Aggregation</Label>
                <select
                    className="rounded-md border border-[var(--zoru-border,#e5e7eb)] bg-[var(--zoru-surface,#fff)] px-2 py-1 text-sm"
                    value={config.aggFunc ?? 'sum'}
                    onChange={(e) => onChange({ ...config, aggFunc: e.target.value as AggregateFunc })}
                >
                    {AGG_FUNCS.map((f) => (
                        <option key={f} value={f}>
                            {f}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function UnpivotEditor({
    step,
    columns,
    onChange,
}: {
    step: Extract<Step, { kind: 'unpivot' }>;
    columns: string[];
    onChange: (c: Extract<Step, { kind: 'unpivot' }>['config']) => void;
}) {
    const { config } = step;
    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 grid gap-1">
                <Label className="text-xs">Value columns (comma-separated)</Label>
                <Input
                    value={config.valueColumns.join(',')}
                    onChange={(e) =>
                        onChange({
                            ...config,
                            valueColumns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                    }
                />
                <div className="flex flex-wrap gap-1">
                    {columns.map((c) => (
                        <Badge
                            key={c}
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() =>
                                onChange({
                                    ...config,
                                    valueColumns: [...config.valueColumns, c],
                                })
                            }
                        >
                            {c}
                        </Badge>
                    ))}
                </div>
            </div>
            <div className="grid gap-1">
                <Label className="text-xs">Var name</Label>
                <Input
                    value={config.varName}
                    onChange={(e) => onChange({ ...config, varName: e.target.value })}
                />
            </div>
            <div className="grid gap-1">
                <Label className="text-xs">Value name</Label>
                <Input
                    value={config.valueName}
                    onChange={(e) => onChange({ ...config, valueName: e.target.value })}
                />
            </div>
        </div>
    );
}
