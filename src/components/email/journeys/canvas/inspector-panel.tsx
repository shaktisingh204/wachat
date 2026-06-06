'use client';

import { Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/sabcrm/20ui';
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
      <Card className="p-4">
        <p className="text-sm text-[var(--st-text-secondary)]">Select a step to edit its details.</p>
      </Card>
    );
  }
  const meta = NODE_META[node.type];
  const Icon = meta?.icon;

  const patchData = (patch: Partial<EmailJourneyNode['data']>) =>
    onChange({ ...node, data: { ...node.data, ...patch } });

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-3">
        {Icon ? <Icon className={`h-4 w-4 ${meta!.accent}`} /> : null}
        <p className="text-sm font-medium">{meta?.label ?? node.type}</p>
        <span className="ml-auto text-[10px] text-[var(--st-text-secondary)]">{node.id}</span>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ins-label">Label</Label>
        <Input
          id="ins-label"
          value={node.data.label ?? ''}
          placeholder="Optional step label"
          onChange={(e) => patchData({ label: e.target.value })}
        />
      </div>

      {node.type === 'trigger' ? (
        <div className="space-y-2">
          <Label>Trigger kind</Label>
          <Select
            value={node.data.trigger?.kind ?? 'list_join'}
            onValueChange={(v) =>
              patchData({ trigger: { kind: v as EmailJourneyTriggerKind, config: node.data.trigger?.config ?? {} } })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIGGER_KINDS.map((k) => (
                <SelectItem key={k} value={k}>{k.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {node.type === 'email' ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="ins-subj">Subject line</Label>
            <Input
              id="ins-subj"
              value={node.data.emailSubject ?? ''}
              onChange={(e) => patchData({ emailSubject: e.target.value })}
              placeholder="Re: your order"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ins-tpl">Template id</Label>
            <Input
              id="ins-tpl"
              value={node.data.emailTemplateId ?? ''}
              onChange={(e) => patchData({ emailTemplateId: e.target.value })}
              placeholder="email_template:..."
            />
            <p className="text-[11px] text-[var(--st-text-secondary)]">Pick a template from the Templates tab and paste its id.</p>
          </div>
        </>
      ) : null}

      {node.type === 'wait' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="ins-wait-v">Duration</Label>
            <Input
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
            <Label>Unit</Label>
            <Select
              value={node.data.waitFor?.unit ?? 'days'}
              onValueChange={(v) =>
                patchData({ waitFor: { value: node.data.waitFor?.value ?? 1, unit: v as 'minutes' | 'hours' | 'days' } })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WAIT_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {node.type === 'condition' ? (
        <div className="space-y-2">
          <Label>If subscriber matches</Label>
          <EmailSegmentBuilder
            value={node.data.condition ?? emptyFilterTree()}
            onChange={(next) => patchData({ condition: next })}
          />
        </div>
      ) : null}

      {node.type === 'action' ? (
        <>
          <div className="space-y-1">
            <Label>Action kind</Label>
            <Select
              value={node.data.action?.kind ?? 'tag_add'}
              onValueChange={(v) =>
                patchData({
                  action: { kind: v as NonNullable<EmailJourneyNode['data']['action']>['kind'], config: node.data.action?.config ?? {} },
                })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTION_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{k.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ins-action-cfg">Action config (JSON)</Label>
            <Textarea
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
          <Label htmlFor="ins-split">Split weights (comma-separated, must sum to 100)</Label>
          <Input
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
        <p className="text-sm text-[var(--st-text-secondary)]">Subscribers reaching this step leave the journey.</p>
      ) : null}
    </Card>
  );
}
