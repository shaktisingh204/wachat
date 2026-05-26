'use client';

import * as React from 'react';

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useZoruToast,
} from '@/components/zoruui';

import {
  createVersion,
  deleteVersion,
  updateVersion,
} from '@/app/actions/bug-tracker.actions';
import type {
  BugVersionDoc,
  BugVersionStatus,
} from '@/lib/rust-client/bug-tracker-versions';

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
  const toast = useZoruToast();
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
      <h1 className="text-xl font-semibold text-[var(--zoru-ink)]">
        Versions & releases
      </h1>
      {initialError ? (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {initialError}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--zoru-ink)]">
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
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="none">No project</ZoruSelectItem>
                {projectOptions.map((p) => (
                  <ZoruSelectItem key={p.id} value={p.id}>
                    {p.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
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
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Released</TableHead>
              <TableHead aria-label="row actions" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-[var(--zoru-ink-muted)]">
                  No versions yet.
                </TableCell>
              </TableRow>
            ) : null}
            {versions.map((v) => (
              <TableRow key={v._id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell className="text-xs text-[var(--zoru-ink-muted)]">
                  {projectOptions.find((p) => p.id === v.projectId)?.name ?? '—'}
                </TableCell>
                <TableCell>
                  <Select
                    value={v.status}
                    onValueChange={(next) =>
                      setStatus(v._id, next as BugVersionStatus)
                    }
                  >
                    <ZoruSelectTrigger className="w-[140px]">
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {STATUSES.map((s) => (
                        <ZoruSelectItem key={s} value={s}>
                          {s}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-[var(--zoru-ink-muted)]">
                  {v.releasedAt
                    ? new Date(v.releasedAt).toLocaleDateString()
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => remove(v._id)}
                  >
                    Archive
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
