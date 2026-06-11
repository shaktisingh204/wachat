'use client';

/**
 * SabBigin pipeline governance editor.
 *
 * Configures the Bigin-beating pipeline power that lives in the
 * `sabbigin_pipeline_config` sidecar: per-stage required-field gates,
 * approval gates, win/lost marking, and connected-pipeline routing. Persisted
 * via `saveSabbiginPipelineConfig`; consumed at drag time by
 * `moveSabbiginDealStage`.
 */

import React from 'react';
import { Plus, Trash2, ShieldCheck, GitBranch, Save } from 'lucide-react';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Field,
  toast,
} from '@/components/sabcrm/20ui';
import {
  saveSabbiginPipelineConfig,
  type SabbiginStageRule,
  type SabbiginConnection,
  type SabbiginPipelineConfigDoc,
} from '@/app/actions/sabbigin-pipeline-config.actions';
import type { SabPipelineSummary } from '@/components/sabbigin/lib/types';

const DEAL_FIELDS: { key: string; label: string }[] = [
  { key: 'value', label: 'Deal value' },
  { key: 'closeDate', label: 'Expected close date' },
  { key: 'probability', label: 'Probability' },
  { key: 'description', label: 'Description' },
  { key: 'nextStep', label: 'Next step' },
  { key: 'contactId', label: 'Contact' },
  { key: 'ownerId', label: 'Owner' },
  { key: 'priority', label: 'Priority' },
];

let connSeq = 0;
function newConnId() {
  connSeq += 1;
  return `conn-${Date.now()}-${connSeq}`;
}

export function PipelineGovernanceEditor({
  pipelineId,
  stageNames,
  pipelines,
  initial,
}: {
  pipelineId: string;
  stageNames: string[];
  pipelines: SabPipelineSummary[];
  initial: SabbiginPipelineConfigDoc | null;
}) {
  const [rules, setRules] = React.useState<Record<string, SabbiginStageRule>>(
    initial?.stageRules ?? {},
  );
  const [connections, setConnections] = React.useState<SabbiginConnection[]>(
    initial?.connections ?? [],
  );
  const [saving, setSaving] = React.useState(false);

  function ruleFor(stage: string): SabbiginStageRule {
    return rules[stage] ?? {};
  }
  function setRule(stage: string, patch: Partial<SabbiginStageRule>) {
    setRules((r) => ({ ...r, [stage]: { ...ruleFor(stage), ...patch } }));
  }
  function toggleRequired(stage: string, fieldKey: string) {
    const cur = ruleFor(stage).requiredFields ?? [];
    const next = cur.includes(fieldKey)
      ? cur.filter((k) => k !== fieldKey)
      : [...cur, fieldKey];
    setRule(stage, { requiredFields: next });
  }

  function addConnection() {
    setConnections((c) => [
      ...c,
      {
        id: newConnId(),
        fromStage: stageNames[0] ?? '',
        event: 'enter',
        targetPipelineId: pipelines.find((p) => p.id !== pipelineId)?.id ?? '',
        targetStage: '',
        active: true,
      },
    ]);
  }
  function updateConnection(id: string, patch: Partial<SabbiginConnection>) {
    setConnections((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeConnection(id: string) {
    setConnections((c) => c.filter((x) => x.id !== id));
  }

  async function save() {
    setSaving(true);
    const res = await saveSabbiginPipelineConfig(pipelineId, {
      stageRules: rules,
      connections,
    });
    setSaving(false);
    if (res.success) toast.success({ title: 'Governance saved' });
    else toast.error({ title: 'Save failed', description: res.error });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card padding="lg">
        <CardHeader>
          <div className="flex w-full items-center justify-between">
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Stage rules
              </span>
            </CardTitle>
            <span className="text-[12px] text-[var(--st-text-secondary)]">
              Required fields &amp; approvals before a deal enters a stage
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-3">
            {stageNames.map((stage) => {
              const rule = ruleFor(stage);
              return (
                <div
                  key={stage}
                  className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[var(--st-text)]">
                      {stage}
                    </span>
                    <label className="flex items-center gap-1.5 text-[12px] text-[var(--st-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={!!rule.approvalRequired}
                        onChange={(e) =>
                          setRule(stage, { approvalRequired: e.target.checked })
                        }
                      />
                      Require approval
                      {rule.approvalRequired && (
                        <Badge tone="warning">Gated</Badge>
                      )}
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DEAL_FIELDS.map((f) => {
                      const on = (rule.requiredFields ?? []).includes(f.key);
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => toggleRequired(stage, f.key)}
                          className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                            on
                              ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft,#e8effe)] text-[var(--st-accent)]'
                              : 'border-[var(--st-border)] text-[var(--st-text-secondary)] hover:border-[var(--st-accent)]'
                          }`}
                        >
                          {on ? '✓ ' : ''}
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card padding="lg">
        <CardHeader>
          <div className="flex w-full items-center justify-between">
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <GitBranch className="h-4 w-4" /> Connected pipelines
              </span>
            </CardTitle>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Plus size={13} />}
              onClick={addConnection}
            >
              Add connection
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {connections.length === 0 ? (
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              Auto-create a deal in another pipeline when a deal here enters a
              stage, is won, or is lost. Great for handing a won sale to an
              onboarding pipeline.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="grid grid-cols-1 items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 sm:grid-cols-5"
                >
                  <Field label="When deal">
                    <select
                      className="u-input u-input--sm"
                      value={conn.event}
                      onChange={(e) =>
                        updateConnection(conn.id, {
                          event: e.target.value as SabbiginConnection['event'],
                        })
                      }
                    >
                      <option value="enter">enters stage</option>
                      <option value="won">is won</option>
                      <option value="lost">is lost</option>
                    </select>
                  </Field>
                  <Field label="Stage">
                    <select
                      className="u-input u-input--sm"
                      value={conn.fromStage}
                      onChange={(e) =>
                        updateConnection(conn.id, { fromStage: e.target.value })
                      }
                      disabled={conn.event !== 'enter'}
                    >
                      <option value="">any</option>
                      {stageNames.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Target pipeline">
                    <select
                      className="u-input u-input--sm"
                      value={conn.targetPipelineId}
                      onChange={(e) =>
                        updateConnection(conn.id, {
                          targetPipelineId: e.target.value,
                        })
                      }
                    >
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Target stage">
                    <input
                      className="u-input u-input--sm"
                      placeholder="e.g. New"
                      value={conn.targetStage}
                      onChange={(e) =>
                        updateConnection(conn.id, { targetStage: e.target.value })
                      }
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Trash2 size={13} />}
                    onClick={() => removeConnection(conn.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="primary"
          iconLeft={<Save size={14} />}
          loading={saving}
          onClick={save}
        >
          Save governance
        </Button>
      </div>
    </div>
  );
}
