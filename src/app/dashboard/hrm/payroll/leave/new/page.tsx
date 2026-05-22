'use client';

import {
  Card,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFileUrlInput } from '@/components/sabfiles';
import { EntityListShell } from '@/components/crm/entity-list-shell';
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
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="Apply for Leave"
      subtitle="Submit a leave application for an employee."
    >
      <Card className="p-6">
        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
            Loading form…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-zoru-ink">Employee *</Label>
              <Select value={userId || undefined} onValueChange={setUserId}>
                <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select employee" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {employees.map((e) => (
                    <ZoruSelectItem key={e._id} value={e._id}>
                      {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zoru-ink">Leave Type *</Label>
              <Select value={leaveTypeId || undefined} onValueChange={setLeaveTypeId}>
                <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select leave type" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {types.map((t) => (
                    <ZoruSelectItem key={String(t._id)} value={String(t._id)}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: t.color || '#94A3B8' }}
                        />
                        {t.type_name}
                      </span>
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-zoru-ink">Duration</Label>
              <div className="mt-1.5">
                <EnumFormField
                  name="duration"
                  enumName="leaveDuration"
                  initialId={duration}
                  onChange={(id) => setDuration((id ?? 'full-day') as WsLeaveDuration)}
                  allowInlineCreate={false}
                />
              </div>
            </div>

            {duration === 'half-day' ? (
              <div>
                <Label className="text-zoru-ink">Half-day Type</Label>
                <div className="mt-1.5">
                  <EnumFormField
                    name="halfDayType"
                    enumName="halfDayType"
                    initialId={halfDayType}
                    onChange={(id) => setHalfDayType((id ?? 'first-half') as WsHalfDayType)}
                    allowInlineCreate={false}
                  />
                </div>
              </div>
            ) : null}

            <div>
              <Label className="text-zoru-ink">
                {duration === 'multiple' ? 'Start Date *' : 'Leave Date *'}
              </Label>
              <Input
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                required
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            {duration === 'multiple' ? (
              <div>
                <Label className="text-zoru-ink">End Date *</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            ) : null}

            {duration === 'hours' ? (
              <div>
                <Label className="text-zoru-ink">Hours *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            ) : null}

            <div className="md:col-span-2">
              <Label className="text-zoru-ink">Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div>
              <Label className="text-zoru-ink">Days Count</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={daysCount}
                onChange={(e) => setDaysCount(e.target.value)}
                placeholder="Auto-calculated if left blank"
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div>
              <Label className="text-zoru-ink">Attachment Name</Label>
              <Input
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                placeholder="doctor-note.pdf"
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div>
              <Label className="text-zoru-ink">Attachment URL</Label>
              <div className="mt-1.5">
                <SabFileUrlInput
                  accept="all"
                  value={attachmentUrl}
                  onChange={(v) => setAttachmentUrl(v)}
                  placeholder="https://…"
                />
              </div>
            </div>

            <div className="flex gap-2 md:col-span-2 md:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/hrm/payroll/leave')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Submit Application
              </Button>
            </div>
          </form>
        )}
      </Card>
    </EntityListShell>
  );
}
