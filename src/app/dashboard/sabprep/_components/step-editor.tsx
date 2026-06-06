'use client';

import * as React from 'react';
import {
    Input,
    Textarea,
    Field,
    Button,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/sabcrm/20ui';
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

/* Sub-editors */

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

const SELECT_PLACEHOLDER = 'Select a column';

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
        <Field label={label}>
            <Select value={value || undefined} onValueChange={onChange}>
                <SelectTrigger aria-label={label}>
                    <SelectValue placeholder={SELECT_PLACEHOLDER} />
                </SelectTrigger>
                <SelectContent>
                    {columns.map((c) => (
                        <SelectItem key={c} value={c}>
                            {c}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
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
            <Field label="Operator">
                <Select
                    value={config.operator}
                    onValueChange={(v) => onChange({ ...config, operator: v as FilterOperator })}
                >
                    <SelectTrigger aria-label="Operator">
                        <SelectValue placeholder="Select an operator" />
                    </SelectTrigger>
                    <SelectContent>
                        {FILTER_OPS.map((o) => (
                            <SelectItem key={o} value={o}>
                                {o.replace(/_/g, ' ')}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
            <Field label="Value">
                <Input
                    value={typeof config.value === 'object' ? '' : String(config.value ?? '')}
                    onChange={(e) => onChange({ ...config, value: e.target.value })}
                    placeholder="value"
                />
            </Field>
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
            <Field label="To">
                <Input
                    value={config.to}
                    onChange={(e) => onChange({ ...config, to: e.target.value })}
                />
            </Field>
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
            <Field label="Target column">
                <Input
                    value={config.target}
                    onChange={(e) => onChange({ ...config, target: e.target.value })}
                />
            </Field>
            <Field
                label="Expression"
                help={
                    <>
                        Helpers: <code>upper</code>, <code>lower</code>, <code>trim</code>,{' '}
                        <code>concat</code>. Insert column:
                    </>
                }
            >
                <Textarea
                    value={config.expression}
                    onChange={(e) => onChange({ ...config, expression: e.target.value })}
                    placeholder="upper({first_name}) or concat({a},_,{b})"
                    rows={2}
                />
            </Field>
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
                <Field label="Delimiter">
                    <Input
                        value={config.delimiter}
                        onChange={(e) => onChange({ ...config, delimiter: e.target.value })}
                    />
                </Field>
                <Field label="Into (comma-separated)">
                    <Input
                        value={(config.into ?? []).join(',')}
                        onChange={(e) =>
                            onChange({
                                ...config,
                                into: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                        }
                    />
                </Field>
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
                <Field label="Find">
                    <Input
                        value={config.find}
                        onChange={(e) => onChange({ ...config, find: e.target.value })}
                    />
                </Field>
                <Field label="Replace">
                    <Input
                        value={config.replace}
                        onChange={(e) => onChange({ ...config, replace: e.target.value })}
                    />
                </Field>
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
        <Field label="Compare on (empty = all columns)">
            <div className="flex flex-wrap gap-1">
                {columns.map((c) => (
                    <Button
                        key={c}
                        size="sm"
                        variant={subset.includes(c) ? 'primary' : 'outline'}
                        onClick={() => toggle(c)}
                    >
                        {c}
                    </Button>
                ))}
            </div>
        </Field>
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
            <Field label="Fill with">
                <Input
                    value={String(config.fillWith ?? '')}
                    onChange={(e) => onChange({ ...config, fillWith: e.target.value })}
                />
            </Field>
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
            <Field label="Cast to">
                <Select
                    value={config.targetType}
                    onValueChange={(v) => onChange({ ...config, targetType: v as CastType })}
                >
                    <SelectTrigger aria-label="Cast to">
                        <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                        {CAST_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                                {t}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
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
                <Field label="Right dataset">
                    <Select
                        value={config.rightDatasetId || undefined}
                        onValueChange={(v) => onChange({ ...config, rightDatasetId: v })}
                    >
                        <SelectTrigger aria-label="Right dataset">
                            <SelectValue placeholder="Select a dataset" />
                        </SelectTrigger>
                        <SelectContent>
                            {datasets.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field label="Join type">
                    <Select
                        value={config.joinType ?? 'inner'}
                        onValueChange={(v) => onChange({ ...config, joinType: v as JoinType })}
                    >
                        <SelectTrigger aria-label="Join type">
                            <SelectValue placeholder="Select a join type" />
                        </SelectTrigger>
                        <SelectContent>
                            {JOIN_TYPES.map((j) => (
                                <SelectItem key={j} value={j}>
                                    {j}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>
            {config.on.map((k, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                    <ColumnPicker
                        label={i === 0 ? 'Match on (left)' : 'Left'}
                        value={k.left}
                        columns={columns}
                        onChange={(v) => setKey(i, { ...k, left: v })}
                    />
                    <Field label={i === 0 ? 'Match on (right)' : 'Right'}>
                        <Input
                            value={k.right}
                            onChange={(e) => setKey(i, { ...k, right: e.target.value })}
                        />
                    </Field>
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
        <Field label="Other dataset">
            <Select
                value={config.otherDatasetId || undefined}
                onValueChange={(v) => onChange({ ...config, otherDatasetId: v })}
            >
                <SelectTrigger aria-label="Other dataset">
                    <SelectValue placeholder="Select a dataset" />
                </SelectTrigger>
                <SelectContent>
                    {datasets.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                            {d.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
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
            <Field label="Group by">
                <div className="flex flex-wrap gap-1">
                    {columns.map((c) => (
                        <Button
                            key={c}
                            size="sm"
                            variant={groupBy.includes(c) ? 'primary' : 'outline'}
                            onClick={() => toggleGroup(c)}
                        >
                            {c}
                        </Button>
                    ))}
                </div>
            </Field>
            {config.aggregations.map((a, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                    <ColumnPicker
                        label={i === 0 ? 'Aggregations (column)' : 'Column'}
                        value={a.column}
                        columns={columns}
                        onChange={(v) => {
                            const copy = config.aggregations.slice();
                            copy[i] = { ...a, column: v };
                            onChange({ ...config, aggregations: copy });
                        }}
                    />
                    <Field label="Func">
                        <Select
                            value={a.func}
                            onValueChange={(v) => {
                                const copy = config.aggregations.slice();
                                copy[i] = { ...a, func: v as AggregateFunc };
                                onChange({ ...config, aggregations: copy });
                            }}
                        >
                            <SelectTrigger aria-label="Aggregation function">
                                <SelectValue placeholder="Select a function" />
                            </SelectTrigger>
                            <SelectContent>
                                {AGG_FUNCS.map((f) => (
                                    <SelectItem key={f} value={f}>
                                        {f}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Output as">
                        <Input
                            value={a.output}
                            onChange={(e) => {
                                const copy = config.aggregations.slice();
                                copy[i] = { ...a, output: e.target.value };
                                onChange({ ...config, aggregations: copy });
                            }}
                        />
                    </Field>
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
            <div className="col-span-2">
                <Field label="Index columns (comma-separated)">
                    <Input
                        value={(config.indexColumns ?? []).join(',')}
                        onChange={(e) =>
                            onChange({
                                ...config,
                                indexColumns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                        }
                    />
                </Field>
            </div>
            <Field label="Aggregation">
                <Select
                    value={config.aggFunc ?? 'sum'}
                    onValueChange={(v) => onChange({ ...config, aggFunc: v as AggregateFunc })}
                >
                    <SelectTrigger aria-label="Aggregation">
                        <SelectValue placeholder="Select a function" />
                    </SelectTrigger>
                    <SelectContent>
                        {AGG_FUNCS.map((f) => (
                            <SelectItem key={f} value={f}>
                                {f}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
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
                <Field label="Value columns (comma-separated)">
                    <Input
                        value={config.valueColumns.join(',')}
                        onChange={(e) =>
                            onChange({
                                ...config,
                                valueColumns: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                            })
                        }
                    />
                </Field>
                <div className="flex flex-wrap gap-1">
                    {columns.map((c) => (
                        <Button
                            key={c}
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                onChange({
                                    ...config,
                                    valueColumns: [...config.valueColumns, c],
                                })
                            }
                        >
                            {c}
                        </Button>
                    ))}
                </div>
            </div>
            <Field label="Var name">
                <Input
                    value={config.varName}
                    onChange={(e) => onChange({ ...config, varName: e.target.value })}
                />
            </Field>
            <Field label="Value name">
                <Input
                    value={config.valueName}
                    onChange={(e) => onChange({ ...config, valueName: e.target.value })}
                />
            </Field>
        </div>
    );
}
