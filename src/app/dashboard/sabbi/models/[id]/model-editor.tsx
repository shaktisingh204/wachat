'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Database, Play, Plus, Ruler, Save, Sigma, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  runMetricQueryAction,
  updateModelAction,
} from '@/app/actions/sabbi-models.actions';
import { setVerifiedAction } from '@/app/actions/sabbi-governance.actions';
import type {
  BiChartRunResponse,
} from '@/lib/rust-client/bi-charts';
import type {
  BiDimension,
  BiMeasure,
  BiModelDoc,
  BiSegment,
} from '@/lib/rust-client/bi-models';

const AGGS = ['sum', 'avg', 'min', 'max', 'count', 'count_distinct'] as const;
const KINDS = ['string', 'number', 'date', 'boolean'] as const;
const FORMATS = ['', 'currency', 'percent', 'number', 'duration'] as const;

const selectCls =
  'h-9 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] px-2 text-sm text-[var(--st-text)]';

export function ModelEditor({
  model,
  verified = false,
  boardsUsing = 0,
}: {
  model: BiModelDoc;
  verified?: boolean;
  boardsUsing?: number;
}) {
  const [measures, setMeasures] = useState<BiMeasure[]>(model.measures ?? []);
  const [dimensions, setDimensions] = useState<BiDimension[]>(model.dimensions ?? []);
  const [segments, setSegments] = useState<BiSegment[]>(model.segments ?? []);
  const [isVerified, setIsVerified] = useState(verified);
  const [verifying, startVerify] = useTransition();
  const [saving, startSave] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pickedMeasures, setPickedMeasures] = useState<string[]>([]);
  const [pickedDims, setPickedDims] = useState<string[]>([]);
  const [preview, setPreview] = useState<BiChartRunResponse | null>(null);
  const [running, startRun] = useTransition();
  const [runError, setRunError] = useState<string | null>(null);

  function patchMeasure(i: number, patch: Partial<BiMeasure>) {
    setMeasures((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  }
  function patchDimension(i: number, patch: Partial<BiDimension>) {
    setDimensions((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  function save() {
    setError(null);
    startSave(async () => {
      try {
        await updateModelAction(model._id, { measures, dimensions, segments });
        setSavedAt(new Date().toLocaleTimeString());
        setIsVerified(false); // saving edits the logic → verification is auto-stripped
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save model');
      }
    });
  }

  function togglePick(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  function runPreview() {
    setRunError(null);
    setPreview(null);
    startRun(async () => {
      try {
        const res = await runMetricQueryAction({
          modelId: model._id,
          measures: pickedMeasures,
          dimensions: pickedDims,
          chartType: 'table',
          limit: 50,
        });
        setPreview(res);
      } catch (e) {
        setRunError(e instanceof Error ? e.message : 'Query failed');
      }
    });
  }

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link href="/dashboard/sabbi/models" className="hover:underline">
              Models
            </Link>{' '}
            · Semantic model
          </PageEyebrow>
          <PageTitle>{model.name}</PageTitle>
          <PageDescription className="flex items-center gap-2">
            <Database size={13} aria-hidden="true" />
            <span className="font-mono text-xs">{model.collection}</span>
            {model.connector && <Badge tone="info">{model.connector}</Badge>}
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          {savedAt && (
            <span className="text-xs text-[var(--st-text-secondary)]">Saved {savedAt}</span>
          )}
          {boardsUsing > 0 && (
            <Badge tone="neutral">
              Used by {boardsUsing} board{boardsUsing === 1 ? '' : 's'}
            </Badge>
          )}
          {isVerified && <Badge tone="success">Verified</Badge>}
          <Button
            variant="ghost"
            onClick={() =>
              startVerify(async () => {
                await setVerifiedAction(model._id, !isVerified);
                setIsVerified((v) => !v);
              })
            }
            disabled={verifying}
          >
            {isVerified ? 'Unverify' : 'Verify'}
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save size={16} aria-hidden="true" />
            {saving ? 'Saving…' : 'Save model'}
          </Button>
        </PageActions>
      </PageHeader>
      {error && <p className="text-sm text-[var(--st-danger)]">{error}</p>}

      {/* Measures */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sigma size={16} aria-hidden="true" />
            Measures
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setMeasures((ms) => [
                ...ms,
                { key: `measure_${ms.length + 1}`, label: 'New measure', agg: 'sum', column: '' },
              ])
            }
          >
            <Plus size={14} aria-hidden="true" /> Add measure
          </Button>
        </CardHeader>
        <CardBody>
          {measures.length === 0 ? (
            <EmptyState
              icon={Sigma}
              tone="info"
              title="No measures"
              description="Add a measure (an aggregation like sum(amount)) to make this model queryable."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Key</Th>
                  <Th align="left">Label</Th>
                  <Th align="left">Aggregation</Th>
                  <Th align="left">Column</Th>
                  <Th align="left">Format</Th>
                  <Th align="right" />
                </Tr>
              </THead>
              <TBody>
                {measures.map((m, i) => (
                  <Tr key={i}>
                    <Td>
                      <Input
                        value={m.key}
                        onChange={(e) => patchMeasure(i, { key: e.target.value })}
                        className="font-mono text-xs"
                      />
                    </Td>
                    <Td>
                      <Input value={m.label} onChange={(e) => patchMeasure(i, { label: e.target.value })} />
                    </Td>
                    <Td>
                      <select
                        className={selectCls}
                        value={m.agg}
                        onChange={(e) => patchMeasure(i, { agg: e.target.value as BiMeasure['agg'] })}
                      >
                        {AGGS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <Input
                        value={m.column ?? ''}
                        onChange={(e) => patchMeasure(i, { column: e.target.value })}
                        placeholder={m.agg === 'count' ? '(n/a)' : 'data.amount'}
                        className="font-mono text-xs"
                      />
                    </Td>
                    <Td>
                      <select
                        className={selectCls}
                        value={m.format ?? ''}
                        onChange={(e) => patchMeasure(i, { format: e.target.value || undefined })}
                      >
                        {FORMATS.map((f) => (
                          <option key={f} value={f}>
                            {f || '—'}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMeasures((ms) => ms.filter((_, j) => j !== i))}
                        aria-label="Remove measure"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Dimensions */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ruler size={16} aria-hidden="true" />
            Dimensions
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDimensions((ds) => [
                ...ds,
                { key: `dimension_${ds.length + 1}`, label: 'New dimension', column: '', kind: 'string' },
              ])
            }
          >
            <Plus size={14} aria-hidden="true" /> Add dimension
          </Button>
        </CardHeader>
        <CardBody>
          {dimensions.length === 0 ? (
            <EmptyState
              icon={Ruler}
              tone="info"
              title="No dimensions"
              description="Add a dimension (a grouping/axis field like stage or createdAt)."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Key</Th>
                  <Th align="left">Label</Th>
                  <Th align="left">Column</Th>
                  <Th align="left">Kind</Th>
                  <Th align="right" />
                </Tr>
              </THead>
              <TBody>
                {dimensions.map((d, i) => (
                  <Tr key={i}>
                    <Td>
                      <Input
                        value={d.key}
                        onChange={(e) => patchDimension(i, { key: e.target.value })}
                        className="font-mono text-xs"
                      />
                    </Td>
                    <Td>
                      <Input value={d.label} onChange={(e) => patchDimension(i, { label: e.target.value })} />
                    </Td>
                    <Td>
                      <Input
                        value={d.column}
                        onChange={(e) => patchDimension(i, { column: e.target.value })}
                        placeholder="data.stage"
                        className="font-mono text-xs"
                      />
                    </Td>
                    <Td>
                      <select
                        className={selectCls}
                        value={d.kind}
                        onChange={(e) => patchDimension(i, { kind: e.target.value as BiDimension['kind'] })}
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDimensions((ds) => ds.filter((_, j) => j !== i))}
                        aria-label="Remove dimension"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play size={16} aria-hidden="true" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-[var(--st-text-secondary)]">
            Pick measures and dimensions, then run the MetricQuery against this
            model. Save first so new measures/dimensions are persisted.
          </p>
          <div className="flex flex-wrap gap-2">
            {measures.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => togglePick(pickedMeasures, setPickedMeasures, m.key)}
                className="cursor-pointer"
              >
                <Badge tone={pickedMeasures.includes(m.key) ? 'success' : 'neutral'}>
                  <Sigma size={12} aria-hidden="true" />
                  {m.label}
                </Badge>
              </button>
            ))}
            {dimensions.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => togglePick(pickedDims, setPickedDims, d.key)}
                className="cursor-pointer"
              >
                <Badge tone={pickedDims.includes(d.key) ? 'info' : 'neutral'}>
                  <Ruler size={12} aria-hidden="true" />
                  {d.label}
                </Badge>
              </button>
            ))}
          </div>
          <div>
            <Button onClick={runPreview} disabled={running || pickedMeasures.length === 0}>
              <Play size={16} aria-hidden="true" />
              {running ? 'Running…' : 'Run query'}
            </Button>
          </div>
          {runError && <p className="text-sm text-[var(--st-danger)]">{runError}</p>}
          {preview && (
            <div className="overflow-auto">
              {preview.rows.length === 0 ? (
                <EmptyState icon={Database} tone="neutral" title="No rows" description="The query returned no data for this model." />
              ) : (
                <Table>
                  <THead>
                    <Tr>
                      {Object.keys(preview.rows[0]).map((k) => (
                        <Th key={k} align="left">
                          {k}
                        </Th>
                      ))}
                    </Tr>
                  </THead>
                  <TBody>
                    {preview.rows.slice(0, 50).map((row, i) => (
                      <Tr key={i}>
                        {Object.keys(preview.rows[0]).map((k) => (
                          <Td key={k}>{formatCell((row as Record<string, unknown>)[k])}</Td>
                        ))}
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
