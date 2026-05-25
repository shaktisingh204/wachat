'use client';

import { Card, Badge, Button, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  use,
  useEffect,
  useState,
  useTransition } from 'react';
import { fmtDate } from '@/lib/utils';
import {
  Check,
  X,
  Paperclip,
  Trash2,
  Plus,
  MessageCircle,
} from 'lucide-react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
} from '@/components/zoruui';

import { SabFileUrlInput } from '@/components/sabfiles';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getLeave,
  getLeaveTypes,
  getLeaveFiles,
  approveLeave,
  rejectLeave,
  saveLeaveFile,
  deleteLeaveFile,
  addLeaveComment,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type {
  WsLeave,
  WsLeaveFile,
  WsLeaveStatus,
  WsLeaveType,
} from '@/lib/worksuite/leave-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

export default function LeaveDetailClient({
  id,
  initialLeave,
  initialTypes,
  initialEmployees,
  initialFiles,
}: {
  id: string;
  initialLeave: WsLeave | null;
  initialTypes: WsLeaveType[];
  initialEmployees: EmployeeLite[];
  initialFiles: WsLeaveFile[];
}) {
  const { toast } = useZoruToast();
  const [leave, setLeave] = useState<WsLeave | null>(initialLeave);
  const [type, setType] = useState<WsLeaveType | null>(
    initialLeave ? initialTypes.find((x) => String(x._id) === String(initialLeave.leave_type_id)) || null : null
  );
  const employee = initialLeave ? initialEmployees.find((x) => String(x._id) === String(initialLeave.user_id)) : null;
  const [employeeName, setEmployeeName] = useState(
    employee ? [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Unnamed' : initialLeave?.user_id || ''
  );
  const [files, setFiles] = useState<WsLeaveFile[]>(initialFiles);
  const [rejectReason, setRejectReason] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [commentText, setCommentText] = useState('');
  
  // Dialog states
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
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

  const statusVariant = (s?: WsLeaveStatus): 'success' | 'danger' | 'warning' => {
    if (s === 'approved') return 'success';
    if (s === 'rejected') return 'danger';
    return 'warning';
  };

  const handleApprove = () => {
    startActing(async () => {
      const r = await approveLeave(id);
      if (r.success) {
        toast({ title: 'Approved' });
        setApproveDialogOpen(false);
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
        setRejectDialogOpen(false);
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

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    startActing(async () => {
      const r = await deleteLeaveFile(fileToDelete);
      if (r.success) {
        setFileToDelete(null);
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    startActing(async () => {
      const r = await addLeaveComment(id, commentText);
      if (r.success) {
        setCommentText('');
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  return (
    <EntityListShell
      title="Leave Application"
      subtitle="Review application details, attachments and approve or reject."
    >

      {isLoading && !leave ? (
        <Card className="p-6">
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
            Loading…
          </div>
        </Card>
      ) : !leave ? (
        <Card className="p-6">
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
            Leave application not found.
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[12px] uppercase text-zoru-ink-muted">
                  Employee
                </div>
                <div className="text-[18px] text-zoru-ink">
                  {employeeName}
                </div>
              </div>
              <Badge variant={statusVariant(leave.status)}>{leave.status}</Badge>
            </div>

            <dl className="mt-6 grid gap-4 md:grid-cols-3">
              <Field label="Leave Type">
                {type ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px]"
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
                {fmtDate(leave.leave_date)}
              </Field>
              {leave.end_date ? (
                <Field label="End Date">
                  {fmtDate(leave.end_date)}
                </Field>
              ) : null}
              {leave.hours ? <Field label="Hours">{leave.hours}</Field> : null}
              {leave.applied_at ? (
                <Field label="Applied At">
                  {fmtDate(leave.applied_at, 'MMM d, yyyy h:mm a')}
                </Field>
              ) : null}
              {leave.approved_at ? (
                <Field label="Approved/Decided At">
                  {fmtDate(leave.approved_at, 'MMM d, yyyy h:mm a')}
                </Field>
              ) : null}
            </dl>

            <div className="mt-6">
              <div className="text-[12px] uppercase text-zoru-ink-muted">
                Reason
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                {leave.reason || '—'}
              </p>
            </div>

            {leave.reject_reason ? (
              <div className="mt-4 rounded-lg border border-rose-50 bg-rose-50 p-3">
                <div className="text-[12px] uppercase text-zoru-danger-ink">
                  Rejection reason
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-danger-ink">
                  {leave.reject_reason}
                </p>
              </div>
            ) : null}

            {leave.status === 'pending' ? (
              <div className="mt-6 flex flex-wrap gap-3 border-t border-zoru-line pt-4">
                <ZoruAlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                  <ZoruAlertDialogTrigger asChild>
                    <Button type="button" disabled={isActing}>
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  </ZoruAlertDialogTrigger>
                  <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                      <ZoruAlertDialogTitle>Approve Leave Request</ZoruAlertDialogTitle>
                      <ZoruAlertDialogDescription>
                        Are you sure you want to approve this leave request? This will deduct from the employee's balance and notify them.
                      </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                      <ZoruAlertDialogCancel disabled={isActing}>Cancel</ZoruAlertDialogCancel>
                      <ZoruAlertDialogAction onClick={handleApprove} disabled={isActing}>
                        Yes, Approve
                      </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                  </ZoruAlertDialogContent>
                </ZoruAlertDialog>

                <ZoruAlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                  <ZoruAlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={isActing}>
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </ZoruAlertDialogTrigger>
                  <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                      <ZoruAlertDialogTitle>Reject Leave Request</ZoruAlertDialogTitle>
                      <ZoruAlertDialogDescription>
                        Please provide a reason for rejecting this leave application.
                      </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <div className="my-4">
                      <Label htmlFor="rejectReason" className="text-zoru-ink">Rejection Reason</Label>
                      <Textarea
                        id="rejectReason"
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                        placeholder="Why is this being rejected?"
                      />
                    </div>
                    <ZoruAlertDialogFooter>
                      <ZoruAlertDialogCancel disabled={isActing}>Cancel</ZoruAlertDialogCancel>
                      <ZoruAlertDialogAction destructive onClick={handleReject} disabled={isActing || !rejectReason.trim()}>
                        Reject Leave
                      </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                  </ZoruAlertDialogContent>
                </ZoruAlertDialog>
              </div>
            ) : null}
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-[16px] text-zoru-ink">Attachments</h2>
            {files.length === 0 ? (
              <p className="text-[13px] text-zoru-ink-muted">No attachments.</p>
            ) : (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li
                    key={String(f._id)}
                    className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2"
                  >
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-[13px] text-zoru-ink hover:underline"
                    >
                      <Paperclip className="h-4 w-4 text-zoru-ink-muted" />
                      {f.filename}
                    </a>
                    <ZoruAlertDialog>
                      <ZoruAlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => setFileToDelete(String(f._id))}
                          title="Delete attachment"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          Delete
                        </Button>
                      </ZoruAlertDialogTrigger>
                      <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                          <ZoruAlertDialogTitle>Delete Attachment</ZoruAlertDialogTitle>
                          <ZoruAlertDialogDescription>
                            Are you sure you want to delete this attachment? This action cannot be undone.
                          </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                          <ZoruAlertDialogCancel onClick={() => setFileToDelete(null)}>Cancel</ZoruAlertDialogCancel>
                          <ZoruAlertDialogAction destructive onClick={confirmDeleteFile} disabled={isActing}>
                            Delete
                          </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                      </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddFile} className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <Input
                placeholder="File name"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
              <SabFileUrlInput
                accept="document"
                placeholder="https://…"
                value={fileUrl}
                onChange={(v) => setFileUrl(v)}
              />
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-[16px] text-zoru-ink">Activity & Comments</h2>
            
            <div className="relative border-l border-zoru-line ml-3 mb-6 space-y-6 pb-2">
              <div className="relative pl-6">
                <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full bg-zoru-ink-muted border-2 border-zoru-bg" />
                <p className="text-[13px] text-zoru-ink">
                  Leave requested
                </p>
                <p className="text-[12px] text-zoru-ink-muted">
                  {fmtDate(leave.applied_at || leave.createdAt || Date.now(), 'MMM d, yyyy h:mm a')}
                </p>
              </div>

              {leave.comments?.map((comment) => (
                <div key={comment.id} className="relative pl-6">
                  <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-zoru-bg" />
                  <div className="rounded-lg bg-zoru-surface-2 p-3 text-[13px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-zoru-ink">{comment.userName}</span>
                      <span className="text-[11px] text-zoru-ink-muted">
                        {fmtDate(comment.createdAt, 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-zoru-ink whitespace-pre-wrap">{comment.text}</p>
                  </div>
                </div>
              ))}

              {leave.status !== 'pending' && leave.approved_at ? (
                <div className="relative pl-6">
                  <div className={`absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-zoru-bg ${leave.status === 'approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <p className="text-[13px] text-zoru-ink">
                    Leave {leave.status}
                  </p>
                  {leave.reject_reason && (
                    <p className="text-[13px] text-zoru-danger-ink mt-1">
                      Reason: {leave.reject_reason}
                    </p>
                  )}
                  <p className="text-[12px] text-zoru-ink-muted">
                    {fmtDate(leave.approved_at, 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              ) : null}
            </div>

            <form onSubmit={handleAddComment} className="mt-4 flex gap-3">
              <Input
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="h-10 flex-1 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
              <Button type="submit" disabled={isActing || !commentText.trim()}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Comment
              </Button>
            </form>
          </Card>
        </>
      )}
    </EntityListShell>
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
      <dt className="text-[12px] uppercase text-zoru-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-zoru-ink">{children}</dd>
    </div>
  );
}
