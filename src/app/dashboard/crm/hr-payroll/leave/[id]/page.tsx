'use client';

import { use, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  CalendarOff,
  ArrowLeft,
  Check,
  X,
  Paperclip,
  Trash2,
  Plus,
} from 'lucide-react';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getLeave,
  getLeaveTypes,
  getLeaveFiles,
  approveLeave,
  rejectLeave,
  saveLeaveFile,
  deleteLeaveFile,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type {
  WsLeave,
  WsLeaveFile,
  WsLeaveStatus,
  WsLeaveType,
} from '@/lib/worksuite/leave-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

export default function LeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toast } = useToast();
  const [leave, setLeave] = useState<WsLeave | null>(null);
  const [type, setType] = useState<WsLeaveType | null>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [files, setFiles] = useState<WsLeaveFile[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [isLoading, startLoading] = useTransition();
  const [isActing, startActing] = useTransition();

  const load = () => {
    startLoading(async () => {
      const [l, types, emps, fs] = await Promise.all([
        getLeave(id),
        getLeaveTypes(),
        getCrmEmployees(),
        getLeaveFiles(id),
      ]);
      setLeave(l);
      setFiles(fs);
      if (l) {
        const t = types.find((x) => String(x._id) === String(l.leave_type_id)) || null;
        setType(t);
        const e = (emps as EmployeeLite[]).find((x) => String(x._id) === String(l.user_id));
        setEmployeeName(
          e ? [e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed' : l.user_id,
        );
      }
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const statusTone = (s?: WsLeaveStatus): 'green' | 'red' | 'amber' => {
    if (s === 'approved') return 'green';
    if (s === 'rejected') return 'red';
    return 'amber';
  };

  const handleApprove = () => {
    startActing(async () => {
      const r = await approveLeave(id);
      if (r.success) {
        toast({ title: 'Approved' });
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleReject = () => {
    startActing(async () => {
      const r = await rejectLeave(id, rejectReason);
      if (r.success) {
        toast({ title: 'Rejected' });
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl) return;
    const r = await saveLeaveFile({
      leave_id: id,
      filename: fileName || 'attachment',
      url: fileUrl,
    });
    if (r.success) {
      toast({ title: 'Added', description: 'Attachment saved.' });
      setFileName('');
      setFileUrl('');
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    const r = await deleteLeaveFile(fileId);
    if (r.success) {
      load();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Application"
        subtitle="Review application details, attachments and approve or reject."
        icon={CalendarOff}
        actions={
          <Link href="/dashboard/crm/hr-payroll/leave">
            <ClayButton
              variant="pill"
              leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back to list
            </ClayButton>
          </Link>
        }
      />

      {isLoading && !leave ? (
        <ClayCard>
          <div className="py-12 text-center text-[13px] text-clay-ink-muted">
            Loading…
          </div>
        </ClayCard>
      ) : !leave ? (
        <ClayCard>
          <div className="py-12 text-center text-[13px] text-clay-ink-muted">
            Leave application not found.
          </div>
        </ClayCard>
      ) : (
        <>
          <ClayCard>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[12px] uppercase tracking-wide text-clay-ink-muted">
                  Employee
                </div>
                <div className="text-[18px] font-semibold text-clay-ink">
                  {employeeName}
                </div>
              </div>
              <ClayBadge tone={statusTone(leave.status)}>{leave.status}</ClayBadge>
            </div>

            <dl className="mt-6 grid gap-4 md:grid-cols-3">
              <Field label="Leave Type">
                {type ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium"
                    style={{
                      backgroundColor: (type.color || '#94A3B8') + '20',
                      color: type.color || '#64748B',
                      border: `1px solid ${(type.color || '#94A3B8')}40`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: type.color || '#94A3B8' }}
                    />
                    {type.type_name}
                  </span>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Duration">
                {leave.duration}
                {leave.duration === 'half-day' && leave.half_day_type
                  ? ` (${leave.half_day_type})`
                  : ''}
              </Field>
              <Field label="Days">{leave.days_count}</Field>
              <Field label="Leave Date">
                {format(new Date(leave.leave_date), 'dd MMM yyyy')}
              </Field>
              {leave.end_date ? (
                <Field label="End Date">
                  {format(new Date(leave.end_date), 'dd MMM yyyy')}
                </Field>
              ) : null}
              {leave.hours ? <Field label="Hours">{leave.hours}</Field> : null}
              {leave.applied_at ? (
                <Field label="Applied At">
                  {format(new Date(leave.applied_at), 'dd MMM yyyy HH:mm')}
                </Field>
              ) : null}
              {leave.approved_at ? (
                <Field label="Approved/Decided At">
                  {format(new Date(leave.approved_at), 'dd MMM yyyy HH:mm')}
                </Field>
              ) : null}
            </dl>

            <div className="mt-6">
              <div className="text-[12px] uppercase tracking-wide text-clay-ink-muted">
                Reason
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-clay-ink">
                {leave.reason || '—'}
              </p>
            </div>

            {leave.reject_reason ? (
              <div className="mt-4 rounded-clay-md border border-clay-red-soft bg-clay-red-soft p-3">
                <div className="text-[12px] uppercase tracking-wide text-clay-red">
                  Rejection reason
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-clay-red">
                  {leave.reject_reason}
                </p>
              </div>
            ) : null}

            {leave.status === 'pending' ? (
              <div className="mt-6 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[240px]">
                  <Label className="text-clay-ink">Rejection reason (optional)</Label>
                  <Textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                  />
                </div>
                <div className="flex gap-2">
                  <ClayButton
                    type="button"
                    variant="obsidian"
                    onClick={handleApprove}
                    disabled={isActing}
                    leading={<Check className="h-4 w-4" strokeWidth={1.75} />}
                  >
                    Approve
                  </ClayButton>
                  <ClayButton
                    type="button"
                    variant="pill"
                    onClick={handleReject}
                    disabled={isActing}
                    leading={<X className="h-4 w-4" strokeWidth={1.75} />}
                  >
                    Reject
                  </ClayButton>
                </div>
              </div>
            ) : null}
          </ClayCard>

          <ClayCard>
            <h2 className="mb-4 text-[16px] font-semibold text-clay-ink">Attachments</h2>
            {files.length === 0 ? (
              <p className="text-[13px] text-clay-ink-muted">No attachments.</p>
            ) : (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li
                    key={String(f._id)}
                    className="flex items-center justify-between rounded-clay-md border border-clay-border bg-clay-surface-2 px-3 py-2"
                  >
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-[13px] text-clay-ink hover:underline"
                    >
                      <Paperclip className="h-4 w-4 text-clay-ink-muted" />
                      {f.filename}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteFile(String(f._id))}
                    >
                      <Trash2 className="h-4 w-4 text-clay-red" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddFile} className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <Input
                placeholder="File name"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
              <Input
                type="url"
                placeholder="https://…"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
              <ClayButton
                type="submit"
                variant="obsidian"
                leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              >
                Add
              </ClayButton>
            </form>
          </ClayCard>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-wide text-clay-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-clay-ink">{children}</dd>
    </div>
  );
}
