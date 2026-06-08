'use client';

import * as React from 'react';

import { Button, Card, Input, Label, Select, Textarea, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';

import {
  createVersion,
  deleteVersion,
  updateVersion,
} from '@/app/actions/bug-tracker.actions';
import type {
  BugVersionDoc,
  BugVersionStatus,
} from '@/lib/rust-client/sabbugs-versions';

import type { ProjectOption } from './bug-shared';

const STATUSES: BugVersionStatus[] = ['planned', 'released', 'archived'];

export function BugVersionsClient({
  initialVersions,
  initialError,
  projectOptions,
}: {
  initialVersions: BugVersionDoc[];
  initialError?: string;
  projectOptions: ProjectOption[];
}) {
  const { toast } = useToast();
  const [versions, setVersions] = React.useState(initialVersions);
  const [draftName, setDraftName] = React.useState('');
  const [draftProject, setDraftProject] = React.useState<string | undefined>();
  const [draftNotes, setDraftNotes] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function create() {
    if (!draftName.trim()) return;
    setBusy(true);
    const res = await createVersion({
      name: draftName.trim(),
      projectId: draftProject,
      notes: draftNotes || undefined,
    });
    setBusy(false);
    if (res.error) {
      toast?.error?.(res.error);
      return;
    }
    if (res.version) setVersions((prev) => [res.version!, ...prev]);
    setDraftName('');
    setDraftProject(undefined);
    setDraftNotes('');
  }

  async function setStatus(id: string, status: BugVersionStatus) {
    const res = await updateVersion(id, { status });
    if (res.error) {
      toast?.error?.(res.error);
      return;
    }
    setVersions((prev) =>
      prev.map((v) => (v._id === id ? { ...v, status } : v)),
    );
  }

  async function remove(id: string) {
    const res = await deleteVersion(id);
    if (res.deleted) {
      setVersions((prev) => prev.filter((v) => v._id !== id));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-[var(--st-text)]">
        Versions & releases
      </h1>
      {initialError ? (
        <Card className="border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
          {initialError}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--st-text)]">
          New version
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ver-name">Name</Label>
            <Input
              id="ver-name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="v1.4.0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Project</Label>
            <Select
              value={draftProject ?? 'none'}
              onValueChange={(v) =>
                setDraftProject(v === 'none' ? undefined : v)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projectOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={create} disabled={busy || !draftName.trim()}>
              {busy ? 'Saving…' : 'Add version'}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ver-notes">Release notes (optional)</Label>
          <Textarea
            id="ver-notes"
            rows={3}
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Project</Th>
              <Th>Status</Th>
              <Th>Released</Th>
              <Th aria-label="row actions" />
            </Tr>
          </THead>
          <TBody>
            {versions.length === 0 ? (
              <Tr>
                <Td colSpan={5} className="text-center text-sm text-[var(--st-text-secondary)]">
                  No versions yet.
                </Td>
              </Tr>
            ) : null}
            {versions.map((v) => (
              <Tr key={v._id}>
                <Td className="font-medium">{v.name}</Td>
                <Td className="text-xs text-[var(--st-text-secondary)]">
                  {projectOptions.find((p) => p.id === v.projectId)?.name ?? '—'}
                </Td>
                <Td>
                  <Select
                    value={v.status}
                    onValueChange={(next) =>
                      setStatus(v._id, next as BugVersionStatus)
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Td>
                <Td className="text-xs text-[var(--st-text-secondary)]">
                  {v.releasedAt
                    ? new Date(v.releasedAt).toLocaleDateString()
                    : '—'}
                </Td>
                <Td className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove(v._id)}
                  >
                    Archive
                  </Button>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
