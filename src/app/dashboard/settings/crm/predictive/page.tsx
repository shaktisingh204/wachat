'use client';

/**
 * SabCRM — Predictive win-scoring (calibrated) settings
 * (`/dashboard/settings/crm/predictive`).
 *
 * Upgrades the in-house win-probability model with CALIBRATION + per-SEGMENT
 * models + explainability. The page lets an admin:
 *
 *   - pick the object to model (typically the deal object),
 *   - pick an optional categorical field to SEGMENT by (each segment gets its
 *     own logistic model; sparse segments fall back to a global model),
 *   - train, which fits per-segment logistic models, Platt-calibrates them on a
 *     holdout, provisions the `winProbability` field, and re-scores the book,
 *   - read the calibration quality (Brier + ECE, raw-vs-calibrated) and the
 *     per-segment sample counts.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes when the engine is unreachable.
 */

import * as React from 'react';
import { Brain, TrendingUp, RefreshCw, Layers, Gauge } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Button,
  Card,
  Field,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { trainCalibratedModelTw } from '@/app/actions/sabcrm-predict-calibration.actions';
import { listObjectsTw, getObjectTw } from '@/app/actions/sabcrm-objects.actions';

// ---------------------------------------------------------------------------
// Local wire shapes (kept free of any server-only import)
// ---------------------------------------------------------------------------

interface ObjectOption {
  value: string;
  label: string;
}
interface FieldOption {
  key: string;
  label: string;
}

/** Categorical field types that make sensible segment keys. */
const SEGMENT_FIELD_TYPES = new Set([
  'SELECT',
  'TEXT',
  'BOOLEAN',
  'RELATION',
  'PHONE',
  'EMAIL',
]);

const NO_SEGMENT = '__none__';

interface TrainResult {
  trained: boolean;
  segmentField: string | null;
  won: number;
  lost: number;
  n: number;
  brier: number | null;
  ece: number | null;
  rawBrier: number | null;
  updated: number;
  segments: Array<{ segment: string; n: number; brier: number | null }>;
}

function fmt(n: number | null | undefined, dp = 3): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(dp) : '—';
}

/** Lower Brier = better calibration; map to a coarse tone for the badge. */
function brierTone(b: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (b == null) return 'neutral';
  if (b <= 0.15) return 'success';
  if (b <= 0.22) return 'warning';
  return 'danger';
}

export default function PredictiveSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [objectSlug, setObjectSlug] = React.useState<string>('');
  const [segmentField, setSegmentField] = React.useState<string>(NO_SEGMENT);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [training, setTraining] = React.useState(false);
  const [result, setResult] = React.useState<TrainResult | null>(null);

  // Load objects on mount.
  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listObjectsTw(activeProjectId);
      if (!alive) return;
      if (res.ok) {
        const opts = res.data.map((o) => ({
          value: o.slug,
          label: o.labelPlural || o.slug,
        }));
        setObjects(opts);
        // default to a deal-ish object when present.
        const deal = opts.find((o) =>
          /deal|opportunit|lead/i.test(o.value) || /deal|opportunit|lead/i.test(o.label),
        );
        setObjectSlug((s) => s || deal?.value || opts[0]?.value || '');
      } else {
        setError(res.error);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  // Load the selected object's categorical fields for the segment picker.
  React.useEffect(() => {
    if (!objectSlug || !activeProjectId) {
      setFields([]);
      return;
    }
    let alive = true;
    (async () => {
      const res = await getObjectTw(objectSlug, activeProjectId);
      if (!alive) return;
      if (res.ok) {
        setFields(
          (res.data.fields ?? [])
            .filter(
              (f) =>
                !String(f.key).startsWith('__') &&
                SEGMENT_FIELD_TYPES.has(String(f.type)) &&
                f.key !== 'stage' &&
                f.key !== 'status',
            )
            .map((f) => ({ key: f.key, label: f.label || f.key })),
        );
      } else {
        setFields([]);
      }
      // reset the chosen segment + last result when the object changes.
      setSegmentField(NO_SEGMENT);
      setResult(null);
    })();
    return () => {
      alive = false;
    };
  }, [objectSlug, activeProjectId]);

  async function train(): Promise<void> {
    if (!objectSlug || !activeProjectId) {
      toast({ title: 'Pick an object to model.', tone: 'danger' });
      return;
    }
    setTraining(true);
    setError(null);
    const seg = segmentField === NO_SEGMENT ? null : segmentField;
    const res = await trainCalibratedModelTw(objectSlug, seg, activeProjectId);
    setTraining(false);
    if (!res.ok) {
      setResult(null);
      toast({ title: 'Could not train', description: res.error, tone: 'danger' });
      return;
    }
    setResult(res.data as TrainResult);
    toast({
      title: 'Model trained',
      description: `${res.data.updated} records re-scored.`,
      tone: 'success',
    });
  }

  const segLabel = (key: string): string =>
    fields.find((f) => f.key === key)?.label ?? key;

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Predictive win-scoring</PageTitle>
          <PageDescription>
            In-house, calibrated win-probability with per-segment models. Each
            segment of your deals gets its own logistic model; predictions are
            Platt-calibrated on a holdout so the percentages are honest.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[360px_1fr]">
        {/* LEFT — configuration */}
        <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
          {loading || isLoadingProject ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-40" />
            </>
          ) : objects.length === 0 ? (
            <EmptyState
              icon={Brain}
              title="No objects to model"
              description="Create an object with won/lost history to train a predictive model."
            />
          ) : (
            <>
              <Field label="Object to model">
                <Select value={objectSlug} onValueChange={setObjectSlug}>
                  <SelectTrigger aria-label="Object to model">
                    <SelectValue placeholder="Select an object" />
                  </SelectTrigger>
                  <SelectContent>
                    {objects.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Segment by (optional)">
                <Select value={segmentField} onValueChange={setSegmentField}>
                  <SelectTrigger aria-label="Segment field">
                    <SelectValue placeholder="No segmentation (global model)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SEGMENT}>
                      No segmentation (global model)
                    </SelectItem>
                    {fields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <p className="text-[12px] text-[var(--st-text-secondary)]">
                Picking a categorical field trains a separate model per segment.
                Segments with too little history fall back to the global model.
              </p>

              <div className="border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
                <Button
                  variant="primary"
                  iconLeft={Brain}
                  onClick={train}
                  loading={training}
                  disabled={training || !objectSlug}
                >
                  {result ? 'Retrain model' : 'Train model'}
                </Button>
              </div>
            </>
          )}
        </Card>

        {/* RIGHT — quality readout */}
        <div className="flex flex-col gap-[var(--st-space-4)]">
          {!result ? (
            <Card className="p-[var(--st-space-5)]">
              <EmptyState
                icon={Gauge}
                title="No trained model yet"
                description="Train a model to see its calibration quality and per-segment coverage. You need at least 20 deals with both won and lost outcomes."
              />
            </Card>
          ) : (
            <>
              {/* Quality cards */}
              <div className="grid grid-cols-2 gap-[var(--st-space-3)] sm:grid-cols-4">
                <Card className="flex flex-col gap-1 p-[var(--st-space-3)]">
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    Brier (calibrated)
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[20px] font-semibold text-[var(--st-text)]">
                      {fmt(result.brier)}
                    </span>
                    <Badge tone={brierTone(result.brier)} kind="soft">
                      {brierTone(result.brier) === 'success'
                        ? 'Good'
                        : brierTone(result.brier) === 'warning'
                          ? 'Fair'
                          : brierTone(result.brier) === 'danger'
                            ? 'Weak'
                            : '—'}
                    </Badge>
                  </span>
                </Card>
                <Card className="flex flex-col gap-1 p-[var(--st-space-3)]">
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    Brier (raw)
                  </span>
                  <span className="text-[20px] font-semibold text-[var(--st-text)]">
                    {fmt(result.rawBrier)}
                  </span>
                </Card>
                <Card className="flex flex-col gap-1 p-[var(--st-space-3)]">
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    Calibration error (ECE)
                  </span>
                  <span className="text-[20px] font-semibold text-[var(--st-text)]">
                    {fmt(result.ece)}
                  </span>
                </Card>
                <Card className="flex flex-col gap-1 p-[var(--st-space-3)]">
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    Training deals
                  </span>
                  <span className="text-[20px] font-semibold text-[var(--st-text)]">
                    {result.n}
                  </span>
                  <span className="text-[12px] text-[var(--st-text-secondary)]">
                    {result.won} won · {result.lost} lost
                  </span>
                </Card>
              </div>

              {result.rawBrier != null && result.brier != null && (
                <Alert
                  tone={result.brier <= result.rawBrier ? 'success' : 'warning'}
                >
                  {result.brier <= result.rawBrier
                    ? `Calibration improved the Brier score by ${fmt(
                        result.rawBrier - result.brier,
                      )} (lower is better).`
                    : 'Calibration did not improve the score on this holdout — more history will help.'}
                </Alert>
              )}

              {/* Per-segment coverage */}
              <Card className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--st-text)]">
                  <Layers size={16} aria-hidden />
                  Per-segment coverage
                  {result.segmentField && (
                    <Badge tone="neutral" kind="soft">
                      by {segLabel(result.segmentField)}
                    </Badge>
                  )}
                </span>
                {!result.segmentField && (
                  <p className="text-[12px] text-[var(--st-text-secondary)]">
                    No segmentation — one global model serves every record.
                  </p>
                )}
                <div className="flex flex-col gap-[var(--st-space-2)]">
                  {result.segments.map((s) => {
                    const isGlobal = s.segment === '__global__';
                    return (
                      <div
                        key={s.segment}
                        className="flex items-center justify-between gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-[var(--st-space-3)] py-[var(--st-space-2)]"
                      >
                        <span className="flex items-center gap-2 text-[13px] text-[var(--st-text)]">
                          {isGlobal ? (
                            <>
                              <TrendingUp size={14} aria-hidden />
                              Global (fallback)
                            </>
                          ) : (
                            s.segment
                          )}
                        </span>
                        <span className="flex items-center gap-[var(--st-space-3)]">
                          <span className="text-[12px] text-[var(--st-text-secondary)]">
                            {s.n} deal{s.n === 1 ? '' : 's'}
                          </span>
                          <Badge tone={brierTone(s.brier)} kind="soft">
                            Brier {fmt(s.brier)}
                          </Badge>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="flex items-center gap-[var(--st-space-2)] text-[12px] text-[var(--st-text-secondary)]">
                <RefreshCw size={14} aria-hidden />
                {result.updated} record{result.updated === 1 ? '' : 's'} re-scored.
                Predictions write to <code>winProbability</code> with an
                explanation of the top drivers per record.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
