'use client';

import * as React from 'react';
import { Archive, PackageCheck, PackagePlus, Tag } from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Textarea,
  Tr,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

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

function versionStatusTone(s: BugVersionStatus): BadgeTone {
  if (s === 'released') return 'success';
  if (s === 'planned') return 'info';
  return 'neutral';
}

function prettyVersionStatus(s: BugVersionStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

  const counts = React.useMemo(() => {
    let planned = 0;
    let released = 0;
    let archived = 0;
    for (const v of versions) {
      if (v.status === 'planned') planned += 1;
      else if (v.status === 'released') released += 1;
      else if (v.status === 'archived') archived += 1;
    }
    return { planned, released, archived, total: versions.length };
  }, [versions]);

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
    <div className="flex flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Bug tracker</PageEyebrow>
          <PageTitle>Versions and releases</PageTitle>
          <PageDescription>
            Release labels used to mark which version a bug affects and which
            version fixes it. Projects mirror your Worksuite project list.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <section
        aria-label="Release summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard
          label="Planned"
          value={<span className="tabular-nums">{counts.planned}</span>}
          icon={PackagePlus}
          accent="#2563eb"
        />
        <StatCard
          label="Released"
          value={<span className="tabular-nums">{counts.released}</span>}
          icon={PackageCheck}
          accent="#16a34a"
        />
        <StatCard
          label="Archived"
          value={<span className="tabular-nums">{counts.archived}</span>}
          icon={Archive}
        />
        <StatCard
          label="Total"
          value={<span className="tabular-nums">{counts.total}</span>}
          icon={Tag}
        />
      </section>

      {initialError ? (
        <Alert tone="danger" title="Could not load versions">
          {initialError}
        </Alert>
      ) : null}

      <Card padding="none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus size={16} aria-hidden="true" />
            Add a version
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
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
              <Label htmlFor="ver-project">Project</Label>
              <Select
                value={draftProject ?? 'none'}
                onValueChange={(v) =>
                  setDraftProject(v === 'none' ? undefined : v)
                }
              >
                <SelectTrigger id="ver-project">
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
              <Button
                iconLeft={PackagePlus}
                onClick={create}
                loading={busy}
                disabled={busy || !draftName.trim()}
              >
                Add version
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
              placeholder="What shipped in this version?"
            />
          </div>
        </CardBody>
      </Card>

      {versions.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No versions yet"
          description="Add your first release label above to start tagging bugs by version."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Project</Th>
                <Th>Status</Th>
                <Th>Released</Th>
                <Th align="right" aria-label="Row actions" />
              </Tr>
            </THead>
            <TBody>
              {versions.map((v) => (
                <Tr key={v._id}>
                  <Td className="font-medium text-[var(--st-text)]">
                    {v.name}
                  </Td>
                  <Td className="text-xs text-[var(--st-text-secondary)]">
                    {projectOptions.find((p) => p.id === v.projectId)?.name ??
                      '—'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Badge tone={versionStatusTone(v.status)} dot>
                        {prettyVersionStatus(v.status)}
                      </Badge>
                      <Select
                        value={v.status}
                        onValueChange={(next) =>
                          setStatus(v._id, next as BugVersionStatus)
                        }
                      >
                        <SelectTrigger
                          className="h-7 w-[130px] text-xs"
                          aria-label={`Change status for ${v.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {prettyVersionStatus(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </Td>
                  <Td className="text-xs tabular-nums text-[var(--st-text-secondary)]">
                    {v.releasedAt
                      ? new Date(v.releasedAt).toLocaleDateString()
                      : '—'}
                  </Td>
                  <Td align="right">
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={Archive}
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
      )}
    </div>
  );
}
