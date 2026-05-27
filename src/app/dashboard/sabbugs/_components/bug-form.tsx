'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { createBug, updateBug } from '@/app/actions/bug-tracker.actions';
import type {
  BugCreateInput,
  BugDoc,
  BugPriority,
  BugSeverity,
} from '@/lib/rust-client/bug-tracker-bugs';
import type { BugVersionDoc } from '@/lib/rust-client/bug-tracker-versions';

import {
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  type ProjectOption,
} from './bug-shared';

export interface BugFormProps {
  bug?: BugDoc | null;
  projectOptions: ProjectOption[];
  versions: BugVersionDoc[];
}

export function BugForm({ bug, projectOptions, versions }: BugFormProps) {
  const router = useRouter();
  const toast = useZoruToast();
  const [state, setState] = React.useState<BugCreateInput>(() => ({
    title: bug?.title ?? '',
    description: bug?.description ?? '',
    reproSteps: bug?.reproSteps ?? '',
    environment: bug?.environment ?? '',
    projectId: bug?.projectId,
    severity: (bug?.severity as BugSeverity) ?? 'minor',
    priority: (bug?.priority as BugPriority) ?? 'medium',
    assigneeId: bug?.assigneeId,
    affectedVersions: bug?.affectedVersions ?? [],
    fixedInVersion: bug?.fixedInVersion,
    attachmentIds: bug?.attachmentIds ?? [],
  }));
  const [busy, setBusy] = React.useState(false);

  function update<K extends keyof BugCreateInput>(key: K, value: BugCreateInput[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function addAttachment(pick: SabFilePick) {
    setState((prev) => ({
      ...prev,
      attachmentIds: [...(prev.attachmentIds ?? []), pick.id],
    }));
  }

  function removeAttachment(id: string) {
    setState((prev) => ({
      ...prev,
      attachmentIds: (prev.attachmentIds ?? []).filter((x) => x !== id),
    }));
  }

  async function submit() {
    if (!state.title.trim()) {
      toast?.error?.('Title is required.');
      return;
    }
    setBusy(true);
    if (bug?._id) {
      const res = await updateBug(bug._id, state);
      setBusy(false);
      if (res.error) {
        toast?.error?.(res.error);
        return;
      }
      toast?.success?.('Bug updated.');
      router.push(`/dashboard/sabbugs/${bug._id}`);
    } else {
      const res = await createBug(state);
      setBusy(false);
      if (res.error) {
        toast?.error?.(res.error);
        return;
      }
      toast?.success?.('Bug reported.');
      router.push(
        res.id
          ? `/dashboard/sabbugs/${res.id}`
          : '/dashboard/sabbugs',
      );
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <Label htmlFor="bug-title">Title</Label>
        <Input
          id="bug-title"
          value={state.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Short summary of the bug"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="bug-description">Description (markdown)</Label>
        <Textarea
          id="bug-description"
          rows={5}
          value={state.description ?? ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="What is wrong, and what should happen instead?"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="bug-repro">Reproduction steps (one per line, numbered)</Label>
        <Textarea
          id="bug-repro"
          rows={5}
          value={state.reproSteps ?? ''}
          onChange={(e) => update('reproSteps', e.target.value)}
          placeholder={'1. Open …\n2. Click …\n3. Observe …'}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="bug-env">Environment</Label>
        <Textarea
          id="bug-env"
          rows={3}
          value={state.environment ?? ''}
          onChange={(e) => update('environment', e.target.value)}
          placeholder="Browser, OS, app version, network, etc."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SelectField
          label="Project"
          value={state.projectId ?? 'none'}
          onValueChange={(v) => update('projectId', v === 'none' ? undefined : v)}
          options={[
            { value: 'none', label: 'No project' },
            ...projectOptions.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        <SelectField
          label="Severity"
          value={state.severity ?? 'minor'}
          onValueChange={(v) => update('severity', v as BugSeverity)}
          options={BUG_SEVERITIES.map((s) => ({ value: s, label: s }))}
        />
        <SelectField
          label="Priority"
          value={state.priority ?? 'medium'}
          onValueChange={(v) => update('priority', v as BugPriority)}
          options={BUG_PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SelectField
          label="Fixed in version"
          value={state.fixedInVersion ?? 'none'}
          onValueChange={(v) =>
            update('fixedInVersion', v === 'none' ? undefined : v)
          }
          options={[
            { value: 'none', label: 'Not yet fixed' },
            ...versions.map((v) => ({ value: v._id, label: v.name })),
          ]}
        />
        <div className="flex flex-col gap-1">
          <Label>Attachments (from SabFiles)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <SabFilePickerButton onPick={addAttachment}>
              + Attach file
            </SabFilePickerButton>
            {(state.attachmentIds ?? []).map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--zoru-divider)] bg-[var(--zoru-surface-2)] px-2 py-1 text-xs"
              >
                <code className="font-mono">{id.slice(-6)}</code>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  className="text-[var(--zoru-ink-muted)] hover:text-zoru-ink"
                  onClick={() => removeAttachment(id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy || !state.title.trim()}>
          {busy ? 'Saving…' : bug?._id ? 'Save changes' : 'Report bug'}
        </Button>
      </div>
    </Card>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (next: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <ZoruSelectTrigger>
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {options.map((o) => (
            <ZoruSelectItem key={o.value} value={o.value}>
              {o.label}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </Select>
    </div>
  );
}
