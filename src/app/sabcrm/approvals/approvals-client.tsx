'use client';

/**
 * SabCRM — Approvals inbox client (`/sabcrm/approvals`), 20ui.
 *
 * The work queue for stage-gate approval requests (crate `sabcrm-approvals`,
 * raised when a record tries to enter a pipeline stage declared with
 * `requiresApproval: true` — see `sabcrm-stage-gates.actions.ts`):
 *
 *   - Segmented status filter: Pending (default) / Approved / Rejected,
 *     each backed by a paginated `listSabcrmApprovals` query.
 *   - Each row links to the record (`/sabcrm/{objectSlug}/{recordId}`) and
 *     shows the from → to stage (labels resolved from the request's
 *     pipeline), requester, reason and age.
 *   - Pending rows carry Approve / Reject. Reject opens a small note dialog.
 *     After an APPROVE the move is APPLIED here too: the record's stage
 *     field is set to `toStageId` via `updateSabcrmRecordTw`. The stage
 *     FIELD key is resolved the same way the record surface picks its board
 *     group field — the object's `board.groupByField` when it is a SELECT,
 *     else the object's first SELECT field — falling back to `"stage"`, the
 *     pipelines engine's default `stageField` (see
 *     `sabcrmPipelinesApi.board` / `moveRecord`).
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule). The Rust
 * engine may be DOWN at dev time — every failure degrades to inline
 * banners / empty states; the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Inbox,
  RotateCw,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Pagination,
  SegmentedControl,
  Skeleton,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';

import { useProject } from '@/context/project-context';
import {
  decideSabcrmApproval,
  listSabcrmApprovals,
} from '@/app/actions/sabcrm-stage-gates.actions';
import type {
  SabcrmApprovalStatus,
  SabcrmRustApproval,
} from '@/app/actions/sabcrm-stage-gates.actions.types';
import { listPipelinesTw } from '@/app/actions/sabcrm-pipelines.actions';
import type { SabcrmRustPipeline } from '@/app/actions/sabcrm-pipelines.actions.types';
import {
  listSabcrmObjectsTw,
  updateSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

/* ----------------------------------------------------------------- consts */

const PAGE_LIMIT = 20;

const STATUS_ITEMS: ReadonlyArray<{
  value: SabcrmApprovalStatus;
  label: string;
}> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const EMPTY_COPY: Record<SabcrmApprovalStatus, { title: string; body: string }> = {
  pending: {
    title: 'No pending approvals',
    body: 'Stage-gated moves that need a sign-off will queue here.',
  },
  approved: {
    title: 'No approved requests yet',
    body: 'Approved stage moves will be listed here for the record.',
  },
  rejected: {
    title: 'No rejected requests',
    body: 'Rejected stage moves will be listed here with the decider note.',
  },
};

/* ---------------------------------------------------------------- helpers */

/** Coarse relative age ("3h ago") for `createdAt` / `decidedAt` stamps. */
function relativeAge(iso: string | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/**
 * The record `data.<key>` carrying the stage value for one object — the SAME
 * recipe the record surface uses to pick its board group field (the object's
 * `board.groupByField` when it is a SELECT, else the first SELECT field),
 * falling back to `"stage"` (the pipelines engine's default `stageField`).
 */
function resolveStageFieldKey(object: ObjectMetadata | undefined): string {
  if (object) {
    const bySelect = (key: string | null | undefined) => {
      if (!key) return undefined;
      const f = object.fields.find((x) => x.key === key);
      return f && f.type === 'SELECT' ? f : undefined;
    };
    const field =
      bySelect(object.board?.groupByField) ??
      object.fields.find((f) => f.type === 'SELECT');
    if (field) return field.key;
  }
  return 'stage';
}

/* -------------------------------------------------------------- component */

export function ApprovalsClient(): React.JSX.Element {
  const { activeProjectId } = useProject();

  /* ---- list state ------------------------------------------------------ */

  const [status, setStatus] = React.useState<SabcrmApprovalStatus>('pending');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SabcrmRustApproval[]>([]);
  const [total, setTotal] = React.useState(0);
  const [limit, setLimit] = React.useState(PAGE_LIMIT);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

  // Tab / project changes restart at page 1.
  React.useEffect(() => {
    setPage(1);
  }, [status, activeProjectId]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError(null);
    void (async () => {
      const res = await listSabcrmApprovals(
        { status, page, limit: PAGE_LIMIT },
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setListError(res.error);
        setRows([]);
        setTotal(0);
      } else {
        setRows(res.data.approvals);
        setTotal(res.data.total);
        setLimit(res.data.limit || PAGE_LIMIT);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, page, activeProjectId, refreshTick]);

  /* ---- metadata (stage labels + stage-field resolution) ----------------- */

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [pipelines, setPipelines] = React.useState<SabcrmRustPipeline[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [objectsRes, pipelinesRes] = await Promise.all([
        listSabcrmObjectsTw(activeProjectId ?? undefined),
        listPipelinesTw(activeProjectId ?? undefined),
      ]);
      if (cancelled) return;
      if (objectsRes.ok) setObjects(objectsRes.data);
      if (pipelinesRes.ok) setPipelines(pipelinesRes.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const objectBySlug = React.useMemo(() => {
    const map = new Map<string, ObjectMetadata>();
    for (const o of objects) map.set(o.slug, o);
    return map;
  }, [objects]);

  const pipelineById = React.useMemo(() => {
    const map = new Map<string, SabcrmRustPipeline>();
    for (const p of pipelines) map.set(p.id, p);
    return map;
  }, [pipelines]);

  /** Human label for a stage id, via the request's pipeline document. */
  const stageLabel = React.useCallback(
    (approval: SabcrmRustApproval, stageId: string | undefined): string => {
      if (!stageId) return '—';
      const pipeline = pipelineById.get(approval.pipelineId);
      const stage = (pipeline?.stages ?? []).find(
        (s) => String(s.id) === stageId,
      );
      return stage?.label || stageId;
    },
    [pipelineById],
  );

  /* ---- decisions --------------------------------------------------------- */

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{
    tone: 'success' | 'warning';
    title: string;
    body?: string;
  } | null>(null);
  const [rejectTarget, setRejectTarget] =
    React.useState<SabcrmRustApproval | null>(null);
  const [rejectNote, setRejectNote] = React.useState('');

  const handleApprove = React.useCallback(
    (approval: SabcrmRustApproval) => {
      if (busyId) return;
      setBusyId(approval.id);
      setNotice(null);
      void (async () => {
        const decided = await decideSabcrmApproval(
          approval.id,
          'approved',
          undefined,
          activeProjectId ?? undefined,
        );
        if (!decided.ok) {
          setBusyId(null);
          setNotice({
            tone: 'warning',
            title: 'Could not approve',
            body: decided.error,
          });
          return;
        }
        // Apply the move the approval was raised for: write the record's
        // stage field (resolved like the record surface's group field).
        const stageKey = resolveStageFieldKey(
          objectBySlug.get(approval.objectSlug),
        );
        const moved = await updateSabcrmRecordTw(
          approval.objectSlug,
          approval.recordId,
          { [stageKey]: approval.toStageId },
          activeProjectId ?? undefined,
        );
        setBusyId(null);
        if (!moved.ok) {
          setNotice({
            tone: 'warning',
            title: 'Approved, but the move failed',
            body: `${moved.error} — the gate is satisfied, so the card can now be moved from its board.`,
          });
        } else {
          setNotice({
            tone: 'success',
            title: 'Approved',
            body: `Record moved to "${stageLabel(approval, approval.toStageId)}".`,
          });
        }
        refresh();
      })();
    },
    [busyId, activeProjectId, objectBySlug, stageLabel, refresh],
  );

  const handleReject = React.useCallback(() => {
    const approval = rejectTarget;
    if (!approval || busyId) return;
    setBusyId(approval.id);
    setNotice(null);
    void (async () => {
      const note = rejectNote.trim();
      const res = await decideSabcrmApproval(
        approval.id,
        'rejected',
        note || undefined,
        activeProjectId ?? undefined,
      );
      setBusyId(null);
      if (!res.ok) {
        setNotice({
          tone: 'warning',
          title: 'Could not reject',
          body: res.error,
        });
        return;
      }
      setRejectTarget(null);
      setRejectNote('');
      setNotice({ tone: 'success', title: 'Request rejected' });
      refresh();
    })();
  }, [rejectTarget, busyId, rejectNote, activeProjectId, refresh]);

  /* ---- render ------------------------------------------------------------ */

  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const isPending = status === 'pending';
  const empty = EMPTY_COPY[status];

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Approvals</PageTitle>
          <PageDescription>
            Stage moves that require a sign-off — review, approve or reject
            requests raised from gated pipeline stages.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="mt-4 flex items-center justify-between gap-3">
        <SegmentedControl
          items={STATUS_ITEMS}
          value={status}
          onChange={setStatus}
          size="sm"
          aria-label="Filter approvals by status"
        />
        <Button
          variant="ghost"
          size="sm"
          iconLeft={RotateCw}
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {notice ? (
        <div className="my-4">
          <Alert
            tone={notice.tone}
            title={notice.title}
            onClose={() => setNotice(null)}
          >
            {notice.body}
          </Alert>
        </div>
      ) : null}

      {listError ? (
        <div className="my-4">
          <Alert tone="danger" title="Could not load approvals" role="alert">
            {listError}
            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                iconLeft={RotateCw}
                onClick={refresh}
              >
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={44} radius="var(--st-radius)" />
          ))}
        </div>
      ) : !listError && rows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={Inbox}
            title={empty.title}
            description={empty.body}
          />
        </div>
      ) : rows.length > 0 ? (
        <div className="mt-4">
          <Table hover>
            <THead>
              <Tr>
                <Th>Record</Th>
                <Th>Stage move</Th>
                <Th>Requested by</Th>
                <Th>Reason</Th>
                <Th>Age</Th>
                <Th align="right" width={isPending ? 220 : 200}>
                  {isPending ? (
                    <span className="sr-only">Actions</span>
                  ) : (
                    'Decision'
                  )}
                </Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => {
                const object = objectBySlug.get(row.objectSlug);
                const busy = busyId === row.id;
                return (
                  <Tr key={row.id}>
                    <Td>
                      <Link
                        href={`/sabcrm/${row.objectSlug}/${row.recordId}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {object?.labelSingular ?? row.objectSlug}
                        {' · '}
                        <span className="font-mono text-xs">
                          {row.recordId.slice(-6)}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[var(--st-text-secondary)]">
                          {stageLabel(row, row.fromStageId)}
                        </span>
                        <ArrowRight size={12} aria-hidden="true" />
                        <span className="font-medium">
                          {stageLabel(row, row.toStageId)}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="font-mono text-xs"
                        title={row.requestedBy}
                      >
                        {row.requestedBy.slice(0, 8)}…
                      </span>
                    </Td>
                    <Td>
                      {row.reason ? (
                        <span title={row.reason}>
                          {row.reason.length > 64
                            ? `${row.reason.slice(0, 64)}…`
                            : row.reason}
                        </span>
                      ) : (
                        <span className="text-[var(--st-text-tertiary)]">
                          —
                        </span>
                      )}
                    </Td>
                    <Td>
                      <span title={row.createdAt}>
                        {relativeAge(row.createdAt)}
                      </span>
                    </Td>
                    <Td align="right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={Check}
                            loading={busy}
                            disabled={busyId !== null && !busy}
                            onClick={() => handleApprove(row)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={X}
                            disabled={busyId !== null}
                            onClick={() => {
                              setRejectNote('');
                              setRejectTarget(row);
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-0.5">
                          <Badge
                            tone={status === 'approved' ? 'success' : 'danger'}
                            dot
                          >
                            <span className="inline-flex items-center gap-1">
                              {status === 'approved' ? (
                                <ShieldCheck size={12} aria-hidden="true" />
                              ) : (
                                <ShieldX size={12} aria-hidden="true" />
                              )}
                              {relativeAge(row.decidedAt)}
                            </span>
                          </Badge>
                          {row.note ? (
                            <span
                              className="max-w-[180px] truncate text-xs text-[var(--st-text-secondary)]"
                              title={row.note}
                            >
                              {row.note}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      ) : null}

      {!loading && pageCount > 1 ? (
        <div className="mt-4 flex justify-end">
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            size="compact"
          />
        </div>
      ) : null}

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) {
            setRejectTarget(null);
            setRejectNote('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this request?</DialogTitle>
            <DialogDescription>
              The requester is told the move into{' '}
              {rejectTarget
                ? `"${stageLabel(rejectTarget, rejectTarget.toStageId)}"`
                : 'the stage'}{' '}
              was declined. You can add a short note.
            </DialogDescription>
          </DialogHeader>
          <Field label="Note (optional)">
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Why is this move declined?"
            />
          </Field>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={busyId !== null}
              onClick={() => {
                setRejectTarget(null);
                setRejectNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={rejectTarget !== null && busyId === rejectTarget.id}
              onClick={handleReject}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ApprovalsClient;
