'use client';

import {
  Button,
  Field,
  IconButton,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/sabcrm/20ui';
import { Plus, Trash2 } from 'lucide-react';

import { SabFileUrlInput } from '@/components/sabfiles';

/**
 * Right-pane inspector. Shows the trigger form when nothing is selected,
 * otherwise shows the per-node-type settings form. Each form mutates the
 * node's `data` object in place and bubbles a fresh node array up to the
 * editor shell.
 *
 * For `send_media`, the file source is wired through `SabFileUrlInput` -
 * the project-wide policy is that every file input must come from SabFiles.
 */

import { nodeMeta } from './node-registry';
import { FlowTriggerPanel } from './FlowTriggerPanel';
import type {
  FlowNode,
  FlowTrigger,
} from '@/lib/rust-client/telegram-flows';

type Props = {
  selectedNode: FlowNode | null;
  trigger: FlowTrigger;
  onChangeTrigger: (next: FlowTrigger) => void;
  onChangeNode: (node: FlowNode) => void;
  onDeleteNode: () => void;
  disabled?: boolean;
};

export function FlowInspectorPanel({
  selectedNode,
  trigger,
  onChangeTrigger,
  onChangeNode,
  onDeleteNode,
  disabled,
}: Props) {
  if (!selectedNode) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <header>
          <h3 className="text-sm font-semibold text-[var(--st-text)]">Trigger</h3>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Configure how this flow gets activated.
          </p>
        </header>
        <FlowTriggerPanel trigger={trigger} onChange={onChangeTrigger} disabled={disabled} />
      </div>
    );
  }

  const meta = nodeMeta(selectedNode.type);
  const data = (selectedNode.data ?? {}) as Record<string, unknown>;
  const patch = (next: Record<string, unknown>) =>
    onChangeNode({ ...selectedNode, data: { ...data, ...next } });

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          {/* Runtime accent colour comes from the node registry, so the chip
              background must be an inline runtime-computed value. */}
          <span
            className="inline-block rounded-[var(--st-radius)] px-2 py-0.5 text-xs font-semibold text-white"
            style={{ background: meta.accent }}
          >
            {meta.label}
          </span>
          <h3 className="mt-1 text-sm font-semibold text-[var(--st-text)]">{meta.subtitle}</h3>
          <p className="text-xs text-[var(--st-text-secondary)]">Node id: {selectedNode.id}</p>
        </div>
        {!disabled ? (
          <IconButton
            label="Delete node"
            icon={Trash2}
            variant="ghost"
            onClick={onDeleteNode}
          />
        ) : null}
      </header>

      {renderForm(selectedNode.type, data, patch, disabled)}
    </div>
  );
}

/* per-node forms */

function renderForm(
  kind: string,
  data: Record<string, unknown>,
  patch: (next: Record<string, unknown>) => void,
  disabled?: boolean,
) {
  switch (kind) {
    case 'send_message':
      return <SendMessageForm data={data} patch={patch} disabled={disabled} />;
    case 'send_media':
      return <SendMediaForm data={data} patch={patch} disabled={disabled} />;
    case 'send_keyboard':
      return <SendKeyboardForm data={data} patch={patch} disabled={disabled} />;
    case 'wait_for_reply':
      return <WaitForReplyForm data={data} patch={patch} disabled={disabled} />;
    case 'branch_by_text':
    case 'branch_by_callback':
      return <BranchForm data={data} patch={patch} disabled={disabled} />;
    case 'assign_agent':
      return <AssignAgentForm data={data} patch={patch} disabled={disabled} />;
    case 'tag_contact':
      return <TagContactForm data={data} patch={patch} disabled={disabled} />;
    case 'set_variable':
      return <SetVariableForm data={data} patch={patch} disabled={disabled} />;
    case 'http_request':
      return <HttpRequestForm data={data} patch={patch} disabled={disabled} />;
    case 'run_subflow':
      return <RunSubflowForm data={data} patch={patch} disabled={disabled} />;
    case 'end':
      return (
        <p className="text-sm text-[var(--st-text-secondary)]">
          The flow stops here. Nothing to configure.
        </p>
      );
    default:
      return (
        <p className="text-sm text-[var(--st-text-secondary)]">
          No inspector form for this node type yet.
        </p>
      );
  }
}

type FormProps = {
  data: Record<string, unknown>;
  patch: (next: Record<string, unknown>) => void;
  disabled?: boolean;
};

function SendMessageForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Message text">
        <Textarea
          rows={5}
          value={String(data.text ?? '')}
          onChange={(e) => patch({ text: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field label="Parse mode">
        <Select
          value={String(data.parseMode ?? 'HTML')}
          onValueChange={(v) => patch({ parseMode: v })}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Parse mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HTML">HTML</SelectItem>
            <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
            <SelectItem value="None">Plain text</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function SendMediaForm({ data, patch, disabled }: FormProps) {
  const sabFile = (data.sabFile ?? null) as { url?: string; id?: string; name?: string } | null;
  return (
    <div className="flex flex-col gap-3">
      <Field label="Media kind">
        <Select
          value={String(data.mediaKind ?? 'photo')}
          onValueChange={(v) => patch({ mediaKind: v })}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Media kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="photo">Photo</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label>File</Label>
        {/*
          SabFiles policy: every file input must source from the SabFile picker
          (library or upload). `SabFileUrlInput` shows the URL but only allows
          changes through the picker, never a free-text paste.
        */}
        <SabFileUrlInput
          value={sabFile?.url ?? ''}
          onChange={(url, pick) =>
            patch({
              sabFile: pick
                ? { url, id: pick.id, name: pick.name }
                : { url },
            })
          }
          disabled={disabled}
          accept="image"
        />
      </div>

      <Field label="Caption">
        <Textarea
          rows={3}
          value={String(data.caption ?? '')}
          onChange={(e) => patch({ caption: e.target.value })}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

function SendKeyboardForm({ data, patch, disabled }: FormProps) {
  const buttons = (data.buttons ?? []) as Array<{ label?: string; data?: string }>;
  const update = (i: number, p: { label?: string; data?: string }) => {
    const next = buttons.map((b, idx) => (idx === i ? { ...b, ...p } : b));
    patch({ buttons: next });
  };
  return (
    <div className="flex flex-col gap-3">
      <Field label="Prompt text">
        <Textarea
          rows={3}
          value={String(data.text ?? '')}
          onChange={(e) => patch({ text: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Buttons</Label>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={Plus}
            onClick={() => patch({ buttons: [...buttons, { label: '', data: '' }] })}
            disabled={disabled}
          >
            Add
          </Button>
        </div>
        {buttons.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              aria-label={`Button ${i + 1} label`}
              placeholder="Label"
              value={b.label ?? ''}
              onChange={(e) => update(i, { label: e.target.value })}
              disabled={disabled}
            />
            <Input
              aria-label={`Button ${i + 1} callback data`}
              placeholder="callback data"
              value={b.data ?? ''}
              onChange={(e) => update(i, { data: e.target.value })}
              disabled={disabled}
            />
            <IconButton
              label="Remove button"
              icon={Trash2}
              variant="ghost"
              onClick={() => patch({ buttons: buttons.filter((_, idx) => idx !== i) })}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function WaitForReplyForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Timeout (seconds)">
        <Input
          type="number"
          value={String(data.timeoutSeconds ?? 300)}
          onChange={(e) => patch({ timeoutSeconds: Number(e.target.value) || 0 })}
          disabled={disabled}
        />
      </Field>
      <Field label="Save reply as variable">
        <Input
          value={String(data.saveAs ?? '')}
          onChange={(e) => patch({ saveAs: e.target.value })}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

function BranchForm({ data, patch, disabled }: FormProps) {
  const cases = (data.cases ?? []) as string[];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Branch cases</Label>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Plus}
          onClick={() => patch({ cases: [...cases, ''] })}
          disabled={disabled}
        >
          Add
        </Button>
      </div>
      <p className="text-xs text-[var(--st-text-secondary)]">
        Wire one outgoing edge per case; the canvas picks the matching edge by
        label.
      </p>
      {cases.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            aria-label={`Case ${i + 1}`}
            value={c}
            onChange={(e) => {
              const next = cases.map((v, idx) => (idx === i ? e.target.value : v));
              patch({ cases: next });
            }}
            disabled={disabled}
          />
          <IconButton
            label="Remove case"
            icon={Trash2}
            variant="ghost"
            onClick={() => patch({ cases: cases.filter((_, idx) => idx !== i) })}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

function AssignAgentForm({ data, patch, disabled }: FormProps) {
  return (
    <Field label="Team">
      <Input
        value={String(data.team ?? '')}
        onChange={(e) => patch({ team: e.target.value })}
        disabled={disabled}
      />
    </Field>
  );
}

function TagContactForm({ data, patch, disabled }: FormProps) {
  const value = ((data.tags ?? []) as string[]).join(', ');
  return (
    <Field label="Tags (comma-separated)">
      <Input
        value={value}
        onChange={(e) =>
          patch({
            tags: e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        disabled={disabled}
      />
    </Field>
  );
}

function SetVariableForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Variable name">
        <Input
          value={String(data.name ?? '')}
          onChange={(e) => patch({ name: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field label="Value">
        <Input
          value={String(data.value ?? '')}
          onChange={(e) => patch({ value: e.target.value })}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

function HttpRequestForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Method">
          <Select
            value={String(data.method ?? 'GET')}
            onValueChange={(v) => patch({ method: v })}
            disabled={disabled}
          >
            <SelectTrigger aria-label="Method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="URL" className="col-span-2">
          <Input
            value={String(data.url ?? '')}
            onChange={(e) => patch({ url: e.target.value })}
            disabled={disabled}
          />
        </Field>
      </div>
      <Field label="Body (JSON)">
        <Textarea
          rows={4}
          value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body ?? {}, null, 2)}
          onChange={(e) => patch({ body: e.target.value })}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

function RunSubflowForm({ data, patch, disabled }: FormProps) {
  return (
    <Field label="Subflow id">
      <Input
        value={String(data.subflowId ?? '')}
        onChange={(e) => patch({ subflowId: e.target.value })}
        disabled={disabled}
      />
    </Field>
  );
}
