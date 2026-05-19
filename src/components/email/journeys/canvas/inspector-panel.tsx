'use client';

import {
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
} from '@/components/zoruui';
import {
  EmailSegmentBuilder,
  emptyFilterTree,
} from '@/components/email/audience/segment-builder';
import type {
  EmailJourneyNode,
  EmailJourneyTriggerKind,
} from '@/lib/email/types';
import { NODE_META } from './node-types';

interface InspectorPanelProps {
  node: EmailJourneyNode | null;
  onChange: (next: EmailJourneyNode) => void;
}

const TRIGGER_KINDS: EmailJourneyTriggerKind[] = [
  'list_join',
  'tag_added',
  'tag_removed',
  'segment_enter',
  'campaign_open',
  'campaign_click',
  'field_changed',
  'date_anniversary',
  'webhook',
];

const ACTION_KINDS: NonNullable<EmailJourneyNode['data']['action']>['kind'][] = [
  'tag_add',
  'tag_remove',
  'list_move',
  'webhook',
  'update_field',
  'unsubscribe',
];

const WAIT_UNITS: NonNullable<EmailJourneyNode['data']['waitFor']>['unit'][] = [
  'minutes',
  'hours',
  'days',
];

export function InspectorPanel({ node, onChange }: InspectorPanelProps) {
  if (!node) {
    return (
      <ZoruCard className="p-4">
        <p className="text-sm text-zoru-ink-muted">Select a step to edit its details.</p>
      </ZoruCard>
    );
  }
  const meta = NODE_META[node.type];
  const Icon = meta?.icon;

  const patchData = (patch: Partial<EmailJourneyNode['data']>) =>
    onChange({ ...node, data: { ...node.data, ...patch } });

  return (
    <ZoruCard className="p-4 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {Icon ? <Icon className={`h-4 w-4 ${meta!.accent}`} /> : null}
        <p className="text-sm font-medium">{meta?.label ?? node.type}</p>
        <span className="ml-auto text-[10px] text-zoru-ink-muted">{node.id}</span>
      </div>

      <div className="space-y-1">
        <ZoruLabel htmlFor="ins-label">Label</ZoruLabel>
        <ZoruInput
          id="ins-label"
          value={node.data.label ?? ''}
          placeholder="Optional step label"
          onChange={(e) => patchData({ label: e.target.value })}
        />
      </div>

      {node.type === 'trigger' ? (
        <div className="space-y-2">
          <ZoruLabel>Trigger kind</ZoruLabel>
          <ZoruSelect
            value={node.data.trigger?.kind ?? 'list_join'}
            onValueChange={(v) =>
              patchData({ trigger: { kind: v as EmailJourneyTriggerKind, config: node.data.trigger?.config ?? {} } })
            }
          >
            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
            <ZoruSelectContent>
              {TRIGGER_KINDS.map((k) => (
                <ZoruSelectItem key={k} value={k}>{k.replace(/_/g, ' ')}</ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
      ) : null}

      {node.type === 'email' ? (
        <>
          <div className="space-y-1">
            <ZoruLabel htmlFor="ins-subj">Subject line</ZoruLabel>
            <ZoruInput
              id="ins-subj"
              value={node.data.emailSubject ?? ''}
              onChange={(e) => patchData({ emailSubject: e.target.value })}
              placeholder="Re: your order"
            />
          </div>
          <div className="space-y-1">
            <ZoruLabel htmlFor="ins-tpl">Template id</ZoruLabel>
            <ZoruInput
              id="ins-tpl"
              value={node.data.emailTemplateId ?? ''}
              onChange={(e) => patchData({ emailTemplateId: e.target.value })}
              placeholder="email_template:..."
            />
            <p className="text-[11px] text-zoru-ink-muted">Pick a template from the Templates tab and paste its id.</p>
          </div>
        </>
      ) : null}

      {node.type === 'wait' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <ZoruLabel htmlFor="ins-wait-v">Duration</ZoruLabel>
            <ZoruInput
              id="ins-wait-v"
              type="number"
              min={1}
              value={node.data.waitFor?.value ?? 1}
              onChange={(e) =>
                patchData({ waitFor: { value: Math.max(1, Number(e.target.value) || 1), unit: node.data.waitFor?.unit ?? 'days' } })
              }
            />
          </div>
          <div className="space-y-1">
            <ZoruLabel>Unit</ZoruLabel>
            <ZoruSelect
              value={node.data.waitFor?.unit ?? 'days'}
              onValueChange={(v) =>
                patchData({ waitFor: { value: node.data.waitFor?.value ?? 1, unit: v as 'minutes' | 'hours' | 'days' } })
              }
            >
              <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
              <ZoruSelectContent>
                {WAIT_UNITS.map((u) => (
                  <ZoruSelectItem key={u} value={u}>{u}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
        </div>
      ) : null}

      {node.type === 'condition' ? (
        <div className="space-y-2">
          <ZoruLabel>If subscriber matches</ZoruLabel>
          <EmailSegmentBuilder
            value={node.data.condition ?? emptyFilterTree()}
            onChange={(next) => patchData({ condition: next })}
          />
        </div>
      ) : null}

      {node.type === 'action' ? (
        <>
          <div className="space-y-1">
            <ZoruLabel>Action kind</ZoruLabel>
            <ZoruSelect
              value={node.data.action?.kind ?? 'tag_add'}
              onValueChange={(v) =>
                patchData({
                  action: { kind: v as NonNullable<EmailJourneyNode['data']['action']>['kind'], config: node.data.action?.config ?? {} },
                })
              }
            >
              <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
              <ZoruSelectContent>
                {ACTION_KINDS.map((k) => (
                  <ZoruSelectItem key={k} value={k}>{k.replace(/_/g, ' ')}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="space-y-1">
            <ZoruLabel htmlFor="ins-action-cfg">Action config (JSON)</ZoruLabel>
            <ZoruTextarea
              id="ins-action-cfg"
              rows={4}
              className="font-mono text-xs"
              value={JSON.stringify(node.data.action?.config ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  const cfg = JSON.parse(e.target.value || '{}');
                  patchData({
                    action: { kind: node.data.action?.kind ?? 'tag_add', config: cfg },
                  });
                } catch {
                  /* ignore — wait for valid JSON */
                }
              }}
            />
          </div>
        </>
      ) : null}

      {node.type === 'split' ? (
        <div className="space-y-1">
          <ZoruLabel htmlFor="ins-split">Split weights (comma-separated, must sum to 100)</ZoruLabel>
          <ZoruInput
            id="ins-split"
            value={(node.data.splitWeights ?? [50, 50]).join(',')}
            onChange={(e) => {
              const weights = e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
              patchData({ splitWeights: weights });
            }}
          />
        </div>
      ) : null}

      {node.type === 'exit' ? (
        <p className="text-sm text-zoru-ink-muted">Subscribers reaching this step leave the journey.</p>
      ) : null}
    </ZoruCard>
  );
}
