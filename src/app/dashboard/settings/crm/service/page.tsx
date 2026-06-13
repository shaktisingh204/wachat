'use client';

/**
 * SabCRM — Service / SLA settings (`/dashboard/settings/crm/service`).
 *
 * Two cards:
 *
 *   1. ENABLE — provisions the `cases` object via the gated `enableCasesTw`
 *      action (idempotent). Once enabled, cases render through the generic
 *      record surface at `/sabcrm/cases`.
 *
 *   2. SLA POLICY — a per-priority editor (first-response + resolution minutes)
 *      plus the warning ratio, persisted via `saveCasePolicyTw`. Times are
 *      entered in MINUTES (the storage unit) with a human "≈ Xh / Xd" hint.
 *
 * A small CSAT summary strip shows the project's aggregate satisfaction.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error.
 */

import * as React from 'react';
import { LifeBuoy, Save, Timer, SmilePlus } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Card,
  Field,
  Input,
  Badge,
  Alert,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  enableCasesTw,
  getCasePolicyTw,
  saveCasePolicyTw,
  getCsatSummaryTw,
} from '@/app/actions/sabcrm-cases.actions';

// Local mirror of the priority order + labels (no server-only import).
const PRIORITIES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'LOW', label: 'Low' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'HIGH', label: 'High' },
  { key: 'URGENT', label: 'Urgent' },
];

interface PriorityTarget {
  firstResponseMins: number;
  resolutionMins: number;
}
type PolicyDraft = Record<string, PriorityTarget>;

interface CsatSummary {
  count: number;
  average: number;
  satisfactionRate: number;
}

/** Human "≈ 1h 30m / 2d" hint from a minutes value. */
function humanizeMins(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return '—';
  const d = Math.floor(mins / (24 * 60));
  const h = Math.floor((mins % (24 * 60)) / 60);
  const m = Math.round(mins % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return `≈ ${parts.join(' ') || '0m'}`;
}

export default function ServiceSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [policy, setPolicy] = React.useState<PolicyDraft>({});
  const [warningRatio, setWarningRatio] = React.useState(0.8);
  const [csat, setCsat] = React.useState<CsatSummary | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [enabling, setEnabling] = React.useState(false);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [polRes, csatRes] = await Promise.all([
        getCasePolicyTw(activeProjectId),
        getCsatSummaryTw(activeProjectId),
      ]);
      if (!alive) return;
      if (polRes.ok) {
        const draft: PolicyDraft = {};
        for (const p of PRIORITIES) {
          const t = (polRes.data.policy as Record<string, PriorityTarget>)[p.key];
          draft[p.key] = {
            firstResponseMins: t?.firstResponseMins ?? 0,
            resolutionMins: t?.resolutionMins ?? 0,
          };
        }
        setPolicy(draft);
        setWarningRatio(polRes.data.warningRatio ?? 0.8);
      } else {
        setError(polRes.error);
      }
      if (csatRes.ok) {
        setCsat({
          count: csatRes.data.count,
          average: csatRes.data.average,
          satisfactionRate: csatRes.data.satisfactionRate,
        });
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  function patchTarget(key: string, patch: Partial<PriorityTarget>): void {
    setPolicy((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function enable(): Promise<void> {
    if (!activeProjectId) return;
    setEnabling(true);
    const res = await enableCasesTw(activeProjectId);
    setEnabling(false);
    if (!res.ok) {
      toast({ title: 'Could not enable cases', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: res.data.created ? 'Cases enabled' : 'Cases already enabled',
      description: 'Open the Cases workspace to start logging support cases.',
      tone: 'success',
    });
  }

  async function save(): Promise<void> {
    if (!activeProjectId) return;
    setSaving(true);
    const res = await saveCasePolicyTw(
      { policy, warningRatio },
      activeProjectId,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'SLA policy saved', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Service &amp; SLA</PageTitle>
          <PageDescription>
            Enable support cases and set per-priority SLA targets. Cases get a
            live SLA badge and a post-resolution CSAT survey.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="outline"
            iconLeft={LifeBuoy}
            onClick={enable}
            loading={enabling}
            disabled={enabling}
          >
            Enable cases
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* CSAT summary strip */}
      {csat && csat.count > 0 ? (
        <Card className="mb-[var(--st-space-4)] flex flex-wrap items-center gap-[var(--st-space-5)] p-[var(--st-space-4)]">
          <div className="flex items-center gap-2">
            <SmilePlus className="text-[var(--st-accent)]" width={20} height={20} aria-hidden="true" />
            <span className="text-[13px] font-semibold text-[var(--st-text)]">
              Customer satisfaction
            </span>
          </div>
          <Stat label="Avg score" value={`${csat.average} / 5`} />
          <Stat label="Satisfied" value={`${csat.satisfactionRate}%`} />
          <Stat label="Responses" value={String(csat.count)} />
        </Card>
      ) : null}

      {/* SLA policy editor */}
      <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
        <div className="flex items-center gap-2">
          <Timer className="text-[var(--st-text)]" width={18} height={18} aria-hidden="true" />
          <span className="text-[14px] font-semibold text-[var(--st-text)]">
            SLA targets (minutes)
          </span>
        </div>

        {loading || isLoadingProject ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : (
          <div className="flex flex-col gap-[var(--st-space-2)]">
            {PRIORITIES.map((p) => {
              const t = policy[p.key] ?? { firstResponseMins: 0, resolutionMins: 0 };
              return (
                <div
                  key={p.key}
                  className="flex flex-wrap items-end gap-[var(--st-space-3)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-3)]"
                >
                  <div className="w-[90px] pb-2">
                    <Badge tone="neutral" kind="soft">
                      {p.label}
                    </Badge>
                  </div>
                  <Field label="First response (min)" className="min-w-[160px] flex-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={t.firstResponseMins}
                      onChange={(e) =>
                        patchTarget(p.key, { firstResponseMins: Number(e.target.value) })
                      }
                    />
                    <span className="mt-1 block text-[11px] text-[var(--st-text-secondary)]">
                      {humanizeMins(t.firstResponseMins)}
                    </span>
                  </Field>
                  <Field label="Resolution (min)" className="min-w-[160px] flex-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={t.resolutionMins}
                      onChange={(e) =>
                        patchTarget(p.key, { resolutionMins: Number(e.target.value) })
                      }
                    />
                    <span className="mt-1 block text-[11px] text-[var(--st-text-secondary)]">
                      {humanizeMins(t.resolutionMins)}
                    </span>
                  </Field>
                </div>
              );
            })}

            <Field label="Warning threshold (0–1)" className="max-w-[260px]">
              <Input
                type="number"
                inputMode="decimal"
                step={0.05}
                min={0.1}
                max={0.99}
                value={warningRatio}
                onChange={(e) => setWarningRatio(Number(e.target.value))}
              />
              <span className="mt-1 block text-[11px] text-[var(--st-text-secondary)]">
                A case flips to “At risk” once it consumes this fraction of its
                window (0.8 = last 20%).
              </span>
            </Field>
          </div>
        )}

        <div className="flex items-center gap-[var(--st-space-2)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
          <Button
            variant="primary"
            iconLeft={Save}
            onClick={save}
            loading={saving}
            disabled={saving || loading}
          >
            Save SLA policy
          </Button>
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col">
      <span className="text-[18px] font-semibold text-[var(--st-text)]">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </span>
    </div>
  );
}
