'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, LoaderCircle } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  getLeaveTypes,
  saveLeave,
  saveLeaveFile,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type {
  WsLeaveDuration,
  WsLeaveType,
  WsHalfDayType,
} from '@/lib/worksuite/leave-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

export default function ApplyLeavePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [types, setTypes] = useState<WsLeaveType[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSave] = useTransition();

  const [userId, setUserId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [duration, setDuration] = useState<WsLeaveDuration>('full-day');
  const [halfDayType, setHalfDayType] = useState<WsHalfDayType>('first-half');
  const [leaveDate, setLeaveDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hours, setHours] = useState('');
  const [reason, setReason] = useState('');
  const [daysCount, setDaysCount] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  useEffect(() => {
    startTransition(async () => {
      const [ts, es] = await Promise.all([getLeaveTypes(), getCrmEmployees()]);
      setTypes(ts.filter((t) => t.status === 'active'));
      setEmployees(
        (es as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
        })),
      );
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !leaveTypeId || !leaveDate) {
      toast({
        title: 'Missing fields',
        description: 'Employee, type and leave date are required.',
        variant: 'destructive',
      });
      return;
    }
    startSave(async () => {
      const res = await saveLeave({
        user_id: userId,
        leave_type_id: leaveTypeId,
        duration,
        half_day_type: duration === 'half-day' ? halfDayType : undefined,
        leave_date: leaveDate,
        end_date: duration === 'multiple' ? endDate : undefined,
        hours: duration === 'hours' ? Number(hours) : undefined,
        reason,
        status: 'pending',
        applied_at: new Date(),
        days_count: daysCount ? Number(daysCount) : 0,
      });
      if (!res.success) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      if (attachmentUrl && res.id) {
        await saveLeaveFile({
          leave_id: res.id,
          filename: attachmentName || 'attachment',
          url: attachmentUrl,
        });
      }
      toast({ title: 'Submitted', description: 'Leave application submitted.' });
      router.push('/dashboard/hrm/payroll/leave');
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Apply for Leave"
        subtitle="Submit a leave application for an employee."
        icon={CalendarPlus}
      />
      <ClayCard>
        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-clay-ink-muted">
            Loading form…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-clay-ink">Employee *</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-clay-ink">Leave Type *</Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={String(t._id)} value={String(t._id)}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: t.color || '#94A3B8' }}
                        />
                        {t.type_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-clay-ink">Duration</Label>
              <Select value={duration} onValueChange={(v) => setDuration(v as WsLeaveDuration)}>
                <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-day">Full day</SelectItem>
                  <SelectItem value="half-day">Half day</SelectItem>
                  <SelectItem value="multiple">Multiple days</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {duration === 'half-day' ? (
              <div>
                <Label className="text-clay-ink">Half-day Type</Label>
                <Select value={halfDayType} onValueChange={(v) => setHalfDayType(v as WsHalfDayType)}>
                  <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first-half">First half</SelectItem>
                    <SelectItem value="second-half">Second half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div>
              <Label className="text-clay-ink">
                {duration === 'multiple' ? 'Start Date *' : 'Leave Date *'}
              </Label>
              <Input
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                required
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            {duration === 'multiple' ? (
              <div>
                <Label className="text-clay-ink">End Date *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            ) : null}

            {duration === 'hours' ? (
              <div>
                <Label className="text-clay-ink">Hours *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            ) : null}

            <div className="md:col-span-2">
              <Label className="text-clay-ink">Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            <div>
              <Label className="text-clay-ink">Days Count</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={daysCount}
                onChange={(e) => setDaysCount(e.target.value)}
                placeholder="Auto-calculated if left blank"
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            <div>
              <Label className="text-clay-ink">Attachment Name</Label>
              <Input
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="doctor-note.pdf"
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label className="text-clay-ink">Attachment URL</Label>
              <Input
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 md:justify-end">
              <ClayButton
                type="button"
                variant="pill"
                onClick={() => router.push('/dashboard/hrm/payroll/leave')}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : null
                }
              >
                Submit Application
              </ClayButton>
            </div>
          </form>
        )}
      </ClayCard>
    </div>
  );
}
