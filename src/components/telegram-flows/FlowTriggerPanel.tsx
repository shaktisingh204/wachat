'use client';

import { Input, Label, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
/**
 * Trigger configuration panel — rendered above the canvas and inside the
 * inspector when no node is selected. The shape mirrors `FlowTrigger` on the
 * Rust side (kind + filter | command | dataPrefix | cron). Changes propagate
 * up via `onChange` which the editor shell debounces and auto-saves.
 */
import type {
  FlowTrigger,
  TriggerKind,
} from '@/lib/rust-client/telegram-flows';

const TRIGGER_KINDS: Array<{ value: TriggerKind; label: string; hint: string }> = [
  { value: 'incoming_message', label: 'Incoming message', hint: 'Any user text message' },
  { value: 'command', label: 'Slash command', hint: 'A /name command' },
  { value: 'callback_query', label: 'Callback query', hint: 'Inline keyboard button press' },
  { value: 'schedule', label: 'Schedule (cron)', hint: 'Time-based trigger' },
  { value: 'business_connection', label: 'Business connection', hint: 'Business account event' },
];

const FILTER_KINDS = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact' },
  { value: 'regex', label: 'Regex' },
  { value: 'hasMedia', label: 'Has media' },
] as const;

type Props = {
  trigger: FlowTrigger;
  onChange: (next: FlowTrigger) => void;
  disabled?: boolean;
};

export function FlowTriggerPanel({ trigger, onChange, disabled }: Props) {
  const kind = (trigger?.kind || 'incoming_message') as TriggerKind;

  const patch = (p: Partial<FlowTrigger>) => onChange({ ...trigger, ...p });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trigger-kind">Trigger</Label>
        <Select
          value={kind}
          onValueChange={(v) => patch({ kind: v as TriggerKind })}
          disabled={disabled}
        >
          <ZoruSelectTrigger id="trigger-kind">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {TRIGGER_KINDS.map((t) => (
              <ZoruSelectItem key={t.value} value={t.value}>
                {t.label}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
        <p className="text-xs text-zoru-ink-muted">
          {TRIGGER_KINDS.find((t) => t.value === kind)?.hint ?? ''}
        </p>
      </div>

      {kind === 'incoming_message' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Filter</Label>
            <Select
              value={trigger.filter?.type ?? 'contains'}
              onValueChange={(v) =>
                patch({
                  filter: {
                    type: v as 'contains' | 'exact' | 'regex' | 'hasMedia',
                    value: trigger.filter?.value,
                  },
                })
              }
              disabled={disabled}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {FILTER_KINDS.map((f) => (
                  <ZoruSelectItem key={f.value} value={f.value}>
                    {f.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          {trigger.filter?.type !== 'hasMedia' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trigger-filter-value">Value</Label>
              <Input
                id="trigger-filter-value"
                placeholder="hello"
                value={trigger.filter?.value ?? ''}
                onChange={(e) =>
                  patch({
                    filter: {
                      type: trigger.filter?.type ?? 'contains',
                      value: e.target.value,
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {kind === 'command' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trigger-command">Command (without the leading /)</Label>
          <Input
            id="trigger-command"
            placeholder="start"
            value={trigger.command ?? ''}
            onChange={(e) => patch({ command: e.target.value.replace(/^\//, '') })}
            disabled={disabled}
          />
        </div>
      ) : null}

      {kind === 'callback_query' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trigger-prefix">Callback data prefix</Label>
          <Input
            id="trigger-prefix"
            placeholder="opt_"
            value={trigger.dataPrefix ?? ''}
            onChange={(e) => patch({ dataPrefix: e.target.value })}
            disabled={disabled}
          />
        </div>
      ) : null}

      {kind === 'schedule' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trigger-cron">Cron expression</Label>
          <Input
            id="trigger-cron"
            placeholder="0 9 * * 1-5"
            value={trigger.cron ?? ''}
            onChange={(e) => patch({ cron: e.target.value })}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}
