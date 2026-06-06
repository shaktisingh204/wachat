'use client';

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/sabcrm/20ui';
import {
  Plus,
  Trash2 } from 'lucide-react';

import { SabFileUrlInput } from '@/components/sabfiles';

/**
 * Right-pane inspector. Shows the trigger form when nothing is selected,
 * otherwise shows the per-node-type settings form. Each form mutates the
 * node's `data` object in place and bubbles a fresh node array up to the
 * editor shell.
 *
 * For `send_media`, the file source is wired through `SabFileUrlInput` —
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
          <h3 className="text-sm font-semibold">Trigger</h3>
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
          <span
            className="inline-block rounded px-2 py-0.5 text-xs font-semibold text-white"
            style={{ background: meta.accent }}
          >
            {meta.label}
          </span>
          <h3 className="mt-1 text-sm font-semibold">{meta.subtitle}</h3>
          <p className="text-xs text-[var(--st-text-secondary)]">Node id: {selectedNode.id}</p>
        </div>
        {!disabled ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteNode}
            aria-label="Delete node"
          >
            <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
          </Button>
        ) : null}
      </header>

      {renderForm(selectedNode.type, data, patch, disabled)}
    </div>
  );
}

/* ── per-node forms ───────────────────────────────────────────────────── */

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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sm-text">Message text</Label>
        <Textarea
          id="sm-text"
          rows={5}
          value={String(data.text ?? '')}
          onChange={(e) => patch({ text: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sm-parse">Parse mode</Label>
        <Select
          value={String(data.parseMode ?? 'HTML')}
          onValueChange={(v) => patch({ parseMode: v })}
          disabled={disabled}
        >
          <SelectTrigger id="sm-parse">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HTML">HTML</SelectItem>
            <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
            <SelectItem value="None">Plain text</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function SendMediaForm({ data, patch, disabled }: FormProps) {
  const sabFile = (data.sabFile ?? null) as { url?: string; id?: string; name?: string } | null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sm-kind">Media kind</Label>
        <Select
          value={String(data.mediaKind ?? 'photo')}
          onValueChange={(v) => patch({ mediaKind: v })}
          disabled={disabled}
        >
          <SelectTrigger id="sm-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="photo">Photo</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>File</Label>
        {/*
          SabFiles policy: every file input must source from the SabFile picker
          (library or upload). `SabFileUrlInput` shows the URL but only allows
          changes through the picker — never a free-text paste.
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sm-caption">Caption</Label>
        <Textarea
          id="sm-caption"
          rows={3}
          value={String(data.caption ?? '')}
          onChange={(e) => patch({ caption: e.target.value })}
          disabled={disabled}
        />
      </div>
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sk-text">Prompt text</Label>
        <Textarea
          id="sk-text"
          rows={3}
          value={String(data.text ?? '')}
          onChange={(e) => patch({ text: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Buttons</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => patch({ buttons: [...buttons, { label: '', data: '' }] })}
            disabled={disabled}
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
        {buttons.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Label"
              value={b.label ?? ''}
              onChange={(e) => update(i, { label: e.target.value })}
              disabled={disabled}
            />
            <Input
              placeholder="callback data"
              value={b.data ?? ''}
              onChange={(e) => update(i, { data: e.target.value })}
              disabled={disabled}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => patch({ buttons: buttons.filter((_, idx) => idx !== i) })}
              disabled={disabled}
              aria-label="Remove button"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaitForReplyForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wf-timeout">Timeout (seconds)</Label>
        <Input
          id="wf-timeout"
          type="number"
          value={String(data.timeoutSeconds ?? 300)}
          onChange={(e) => patch({ timeoutSeconds: Number(e.target.value) || 0 })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wf-save">Save reply as variable</Label>
        <Input
          id="wf-save"
          value={String(data.saveAs ?? '')}
          onChange={(e) => patch({ saveAs: e.target.value })}
          disabled={disabled}
        />
      </div>
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
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => patch({ cases: [...cases, ''] })}
          disabled={disabled}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <p className="text-xs text-[var(--st-text-secondary)]">
        Wire one outgoing edge per case; the canvas picks the matching edge by
        label.
      </p>
      {cases.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={c}
            onChange={(e) => {
              const next = cases.map((v, idx) => (idx === i ? e.target.value : v));
              patch({ cases: next });
            }}
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => patch({ cases: cases.filter((_, idx) => idx !== i) })}
            disabled={disabled}
            aria-label="Remove case"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function AssignAgentForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="aa-team">Team</Label>
      <Input
        id="aa-team"
        value={String(data.team ?? '')}
        onChange={(e) => patch({ team: e.target.value })}
        disabled={disabled}
      />
    </div>
  );
}

function TagContactForm({ data, patch, disabled }: FormProps) {
  const value = ((data.tags ?? []) as string[]).join(', ');
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="tc-tags">Tags (comma-separated)</Label>
      <Input
        id="tc-tags"
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
    </div>
  );
}

function SetVariableForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sv-name">Variable name</Label>
        <Input
          id="sv-name"
          value={String(data.name ?? '')}
          onChange={(e) => patch({ name: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sv-value">Value</Label>
        <Input
          id="sv-value"
          value={String(data.value ?? '')}
          onChange={(e) => patch({ value: e.target.value })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function HttpRequestForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hr-method">Method</Label>
          <Select
            value={String(data.method ?? 'GET')}
            onValueChange={(v) => patch({ method: v })}
            disabled={disabled}
          >
            <SelectTrigger id="hr-method">
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
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="hr-url">URL</Label>
          <Input
            id="hr-url"
            value={String(data.url ?? '')}
            onChange={(e) => patch({ url: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hr-body">Body (JSON)</Label>
        <Textarea
          id="hr-body"
          rows={4}
          value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body ?? {}, null, 2)}
          onChange={(e) => patch({ body: e.target.value })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function RunSubflowForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="rs-id">Subflow id</Label>
      <Input
        id="rs-id"
        value={String(data.subflowId ?? '')}
        onChange={(e) => patch({ subflowId: e.target.value })}
        disabled={disabled}
      />
    </div>
  );
}
