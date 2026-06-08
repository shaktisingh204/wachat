'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Field,
  Input,
  Tag,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { createBug, updateBug } from '@/app/actions/bug-tracker.actions';
import type {
  BugCreateInput,
  BugDoc,
  BugPriority,
  BugSeverity,
} from '@/lib/rust-client/sabbugs-bugs';
import type { BugVersionDoc } from '@/lib/rust-client/sabbugs-versions';

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
  const { toast } = useToast();
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
      toast.error('Title is required.');
      return;
    }
    setBusy(true);
    if (bug?._id) {
      const res = await updateBug(bug._id, state);
      setBusy(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Bug updated.');
      router.push(`/dashboard/sabbugs/${bug._id}`);
    } else {
      const res = await createBug(state);
      setBusy(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Bug reported.');
      router.push(
        res.id
          ? `/dashboard/sabbugs/${res.id}`
          : '/dashboard/sabbugs',
      );
    }
  }

  return (
    <Card padding="none">
      <CardBody className="flex flex-col gap-4">
        <Field label="Title">
          <Input
            value={state.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Short summary of the bug"
          />
        </Field>

        <Field label="Description (markdown)">
          <Textarea
            rows={5}
            value={state.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What is wrong, and what should happen instead?"
          />
        </Field>

        <Field label="Reproduction steps (one per line, numbered)">
          <Textarea
            rows={5}
            value={state.reproSteps ?? ''}
            onChange={(e) => update('reproSteps', e.target.value)}
            placeholder={'1. Open the page\n2. Click the button\n3. Observe the error'}
          />
        </Field>

        <Field label="Environment">
          <Textarea
            rows={3}
            value={state.environment ?? ''}
            onChange={(e) => update('environment', e.target.value)}
            placeholder="Browser, OS, app version, network, etc."
          />
        </Field>

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
          <Field label="Attachments (from SabFiles)">
            <div className="flex flex-wrap items-center gap-2">
              <SabFilePickerButton onPick={addAttachment}>
                + Attach file
              </SabFilePickerButton>
              {(state.attachmentIds ?? []).map((id) => (
                <Tag
                  key={id}
                  onRemove={() => removeAttachment(id)}
                  removeLabel="Remove attachment"
                >
                  {id.slice(-6)}
                </Tag>
              ))}
            </div>
          </Field>
        </div>
      </CardBody>

      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          loading={busy}
          disabled={busy || !state.title.trim()}
        >
          {bug?._id ? 'Save changes' : 'Report bug'}
        </Button>
      </CardFooter>
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
    <Field label={label}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
