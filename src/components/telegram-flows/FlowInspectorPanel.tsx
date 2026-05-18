'use client';

import {
  ZoruButton,
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
          <p className="text-xs text-muted-foreground">
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
          <p className="text-xs text-muted-foreground">Node id: {selectedNode.id}</p>
        </div>
        {!disabled ? (
          <ZoruButton
            variant="ghost"
            size="icon"
            onClick={onDeleteNode}
            aria-label="Delete node"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </ZoruButton>
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
        <p className="text-sm text-muted-foreground">
          The flow stops here. Nothing to configure.
        </p>
      );
    default:
      return (
        <p className="text-sm text-muted-foreground">
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
        <ZoruLabel htmlFor="sm-text">Message text</ZoruLabel>
        <ZoruTextarea
          id="sm-text"
          rows={5}
          value={String(data.text ?? '')}
          onChange={(e) => patch({ text: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <ZoruLabel htmlFor="sm-parse">Parse mode</ZoruLabel>
        <ZoruSelect
          value={String(data.parseMode ?? 'HTML')}
          onValueChange={(v) => patch({ parseMode: v })}
          disabled={disabled}
        >
          <ZoruSelectTrigger id="sm-parse">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="HTML">HTML</ZoruSelectItem>
            <ZoruSelectItem value="MarkdownV2">MarkdownV2</ZoruSelectItem>
            <ZoruSelectItem value="None">Plain text</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
      </div>
    </div>
  );
}

function SendMediaForm({ data, patch, disabled }: FormProps) {
  const sabFile = (data.sabFile ?? null) as { url?: string; id?: string; name?: string } | null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <ZoruLabel htmlFor="sm-kind">Media kind</ZoruLabel>
        <ZoruSelect
          value={String(data.mediaKind ?? 'photo')}
          onValueChange={(v) => patch({ mediaKind: v })}
          disabled={disabled}
        >
          <ZoruSelectTrigger id="sm-kind">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="photo">Photo</ZoruSelectItem>
            <ZoruSelectItem value="video">Video</ZoruSelectItem>
            <ZoruSelectItem value="document">Document</ZoruSelectItem>
            <ZoruSelectItem value="audio">Audio</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <ZoruLabel>File</ZoruLabel>
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
        <ZoruLabel htmlFor="sm-caption">Caption</ZoruLabel>
        <ZoruTextarea
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
        <ZoruLabel htmlFor="sk-text">Prompt text</ZoruLabel>
        <ZoruTextarea
          id="sk-text"
          rows={3}
          value={String(data.text ?? '')}
          onChange={(e) => patch({ text: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <ZoruLabel>Buttons</ZoruLabel>
          <ZoruButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => patch({ buttons: [...buttons, { label: '', data: '' }] })}
            disabled={disabled}
          >
            <Plus className="h-3 w-3" /> Add
          </ZoruButton>
        </div>
        {buttons.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <ZoruInput
              placeholder="Label"
              value={b.label ?? ''}
              onChange={(e) => update(i, { label: e.target.value })}
              disabled={disabled}
            />
            <ZoruInput
              placeholder="callback data"
              value={b.data ?? ''}
              onChange={(e) => update(i, { data: e.target.value })}
              disabled={disabled}
            />
            <ZoruButton
              variant="ghost"
              size="icon"
              onClick={() => patch({ buttons: buttons.filter((_, idx) => idx !== i) })}
              disabled={disabled}
              aria-label="Remove button"
            >
              <Trash2 className="h-3 w-3" />
            </ZoruButton>
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
        <ZoruLabel htmlFor="wf-timeout">Timeout (seconds)</ZoruLabel>
        <ZoruInput
          id="wf-timeout"
          type="number"
          value={String(data.timeoutSeconds ?? 300)}
          onChange={(e) => patch({ timeoutSeconds: Number(e.target.value) || 0 })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <ZoruLabel htmlFor="wf-save">Save reply as variable</ZoruLabel>
        <ZoruInput
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
        <ZoruLabel>Branch cases</ZoruLabel>
        <ZoruButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => patch({ cases: [...cases, ''] })}
          disabled={disabled}
        >
          <Plus className="h-3 w-3" /> Add
        </ZoruButton>
      </div>
      <p className="text-xs text-muted-foreground">
        Wire one outgoing edge per case; the canvas picks the matching edge by
        label.
      </p>
      {cases.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <ZoruInput
            value={c}
            onChange={(e) => {
              const next = cases.map((v, idx) => (idx === i ? e.target.value : v));
              patch({ cases: next });
            }}
            disabled={disabled}
          />
          <ZoruButton
            variant="ghost"
            size="icon"
            onClick={() => patch({ cases: cases.filter((_, idx) => idx !== i) })}
            disabled={disabled}
            aria-label="Remove case"
          >
            <Trash2 className="h-3 w-3" />
          </ZoruButton>
        </div>
      ))}
    </div>
  );
}

function AssignAgentForm({ data, patch, disabled }: FormProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <ZoruLabel htmlFor="aa-team">Team</ZoruLabel>
      <ZoruInput
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
      <ZoruLabel htmlFor="tc-tags">Tags (comma-separated)</ZoruLabel>
      <ZoruInput
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
        <ZoruLabel htmlFor="sv-name">Variable name</ZoruLabel>
        <ZoruInput
          id="sv-name"
          value={String(data.name ?? '')}
          onChange={(e) => patch({ name: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <ZoruLabel htmlFor="sv-value">Value</ZoruLabel>
        <ZoruInput
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
          <ZoruLabel htmlFor="hr-method">Method</ZoruLabel>
          <ZoruSelect
            value={String(data.method ?? 'GET')}
            onValueChange={(v) => patch({ method: v })}
            disabled={disabled}
          >
            <ZoruSelectTrigger id="hr-method">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <ZoruSelectItem key={m} value={m}>
                  {m}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <ZoruLabel htmlFor="hr-url">URL</ZoruLabel>
          <ZoruInput
            id="hr-url"
            value={String(data.url ?? '')}
            onChange={(e) => patch({ url: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <ZoruLabel htmlFor="hr-body">Body (JSON)</ZoruLabel>
        <ZoruTextarea
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
      <ZoruLabel htmlFor="rs-id">Subflow id</ZoruLabel>
      <ZoruInput
        id="rs-id"
        value={String(data.subflowId ?? '')}
        onChange={(e) => patch({ subflowId: e.target.value })}
        disabled={disabled}
      />
    </div>
  );
}
