/**
 * Shared step DTOs that mirror the Rust `dataprep-steps` crate.
 *
 * NOTE: This file is intentionally NOT `server-only` — the step type
 * catalog + DTOs are also consumed by the client-side canvas UI. There is
 * no network code or secret access here, only types + a static catalog
 * literal, so it is safe to ship to the browser.
 *
 * Keep these in lock-step with `rust/crates/dataprep-steps/src/{ops,step}.rs`.
 */

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [k: string]: JsonValue };

export type Row = Record<string, JsonValue>;

/* ─── Operators / enums ─────────────────────────────────────────────── */

export type FilterOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'is_null'
    | 'is_not_null';

export type CastType = 'string' | 'number' | 'integer' | 'bool';

export type JoinType = 'inner' | 'left' | 'right' | 'outer';

export type AggregateFunc =
    | 'count'
    | 'sum'
    | 'avg'
    | 'min'
    | 'max'
    | 'count_distinct';

/* ─── Per-step configs ──────────────────────────────────────────────── */

export interface FilterOp {
    column: string;
    operator: FilterOperator;
    value?: JsonValue;
}

export interface RenameOp {
    from: string;
    to: string;
}

export interface DeriveOp {
    target: string;
    expression: string;
}

export interface SplitOp {
    column: string;
    delimiter: string;
    into: string[];
    keepOriginal?: boolean;
}

export interface ReplaceOp {
    column: string;
    find: string;
    replace: string;
    caseInsensitive?: boolean;
    wholeCell?: boolean;
}

export interface DeduplicateOp {
    subset?: string[];
}

export interface FillNullsOp {
    column: string;
    fillWith: JsonValue;
}

export interface TypeCastOp {
    column: string;
    targetType: CastType;
}

export interface JoinKey {
    left: string;
    right: string;
}

export interface JoinOp {
    rightDatasetId: string;
    on: JoinKey[];
    joinType?: JoinType;
    rightSuffix?: string;
}

export interface UnionOp {
    otherDatasetId: string;
}

export interface Aggregation {
    column: string;
    func: AggregateFunc;
    output: string;
}

export interface AggregateOp {
    groupBy?: string[];
    aggregations: Aggregation[];
}

export interface PivotOp {
    pivotColumn: string;
    valueColumn: string;
    indexColumns: string[];
    aggFunc?: AggregateFunc;
}

export interface UnpivotOp {
    valueColumns: string[];
    varName: string;
    valueName: string;
    idColumns?: string[];
}

/* ─── Step envelope — discriminated union on `kind` ─────────────────── */

export type Step =
    | StepBase<'filter', FilterOp>
    | StepBase<'rename', RenameOp>
    | StepBase<'derive', DeriveOp>
    | StepBase<'split', SplitOp>
    | StepBase<'replace', ReplaceOp>
    | StepBase<'deduplicate', DeduplicateOp>
    | StepBase<'fillNulls', FillNullsOp>
    | StepBase<'typeCast', TypeCastOp>
    | StepBase<'join', JoinOp>
    | StepBase<'union', UnionOp>
    | StepBase<'aggregate', AggregateOp>
    | StepBase<'pivot', PivotOp>
    | StepBase<'unpivot', UnpivotOp>;

interface StepBase<K extends string, C> {
    id?: string;
    label?: string;
    disabled?: boolean;
    kind: K;
    config: C;
}

export type StepKind = Step['kind'];

export interface StepError {
    stepIndex: number;
    stepKind: string;
    message: string;
    rowIndex?: number;
}

export interface StepRunSummary {
    stepIndex: number;
    stepKind: string;
    rowsIn: number;
    rowsOut: number;
    errors?: StepError[];
}

/** Human-readable catalog used by the UI to render the step palette. */
export const STEP_CATALOG: ReadonlyArray<{
    kind: StepKind;
    label: string;
    description: string;
}> = [
    { kind: 'filter', label: 'Filter rows', description: 'Keep rows where a column matches a condition.' },
    { kind: 'rename', label: 'Rename column', description: 'Rename one column.' },
    { kind: 'derive', label: 'Derive column', description: 'Compute a new column from an expression.' },
    { kind: 'split', label: 'Split column', description: 'Split one column into many by delimiter.' },
    { kind: 'replace', label: 'Find & replace', description: 'Replace text inside a column.' },
    { kind: 'deduplicate', label: 'Deduplicate', description: 'Drop duplicate rows.' },
    { kind: 'fillNulls', label: 'Fill nulls', description: 'Replace null/empty values in a column.' },
    { kind: 'typeCast', label: 'Cast type', description: 'Coerce a column to string / number / integer / bool.' },
    { kind: 'join', label: 'Join dataset', description: 'Combine with another dataset on key columns.' },
    { kind: 'union', label: 'Union dataset', description: 'Append rows from another dataset.' },
    { kind: 'aggregate', label: 'Aggregate', description: 'Group by + sum / avg / count / etc.' },
    { kind: 'pivot', label: 'Pivot wide', description: 'Turn distinct values into columns.' },
    { kind: 'unpivot', label: 'Unpivot long', description: 'Melt columns into rows.' },
];
