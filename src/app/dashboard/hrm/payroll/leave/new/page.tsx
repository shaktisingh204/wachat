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
  useTransition,
  useMemo
} from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, AlertTriangle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { SabFileUrlInput } from '@/components/sabfiles';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getLeaveTypes,
  saveLeave,
  saveLeaveFile,
  getLeaveBalance,
} from '@/app/actions/worksuite/leave.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type {
  WsLeaveDuration,
  WsLeaveType,
  WsHalfDayType,
  WsLeaveBalanceEmployee,
} from '@/lib/worksuite/leave-types';

type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

const formSchema = z
  .object({
    userId: z.string().min(1, 'Employee is required'),
    leaveTypeId: z.string().min(1, 'Leave type is required'),
    duration: z.enum(['full-day', 'half-day', 'multiple', 'hours']),
    halfDayType: z.enum(['first-half', 'second-half']).optional(),
    leaveDate: z.string().min(1, 'Leave date is required'),
    endDate: z.string().optional(),
    hours: z.string().optional(),
    reason: z.string().optional(),
    daysCount: z.string().optional(),
    attachmentName: z.string().optional(),
    attachmentUrl: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.duration === 'multiple') {
      if (!data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date is required for multiple days',
          path: ['endDate'],
        });
      } else {
        const start = new Date(data.leaveDate);
        const end = new Date(data.endDate);
        if (end < start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'End date must be after or equal to start date',
            path: ['endDate'],
          });
        }
      }
    }
    if (data.duration === 'hours' && !data.hours) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hours are required',
        path: ['hours'],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export default function ApplyLeavePage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [types, setTypes] = useState<WsLeaveType[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [balances, setBalances] = useState<WsLeaveBalanceEmployee[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSave] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      userId: '',
      leaveTypeId: '',
      duration: 'full-day',
      halfDayType: 'first-half',
      leaveDate: '',
      endDate: '',
      hours: '',
      reason: '',
      daysCount: '',
      attachmentName: '',
      attachmentUrl: '',
    },
  });

  const watchUserId = watch('userId');
  const watchLeaveTypeId = watch('leaveTypeId');
  const watchDuration = watch('duration');
  const watchLeaveDate = watch('leaveDate');
  const watchEndDate = watch('endDate');
  const watchHours = watch('hours');
  const watchDaysCount = watch('daysCount');

  useEffect(() => {
    startTransition(async () => {
      const [ts, es, bs] = await Promise.all([
        getLeaveTypes(),
        getCrmEmployees(),
        getLeaveBalance(),
      ]);
      setTypes(ts.filter((t) => t.status === 'active'));
      setEmployees(
        (es as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
        })),
      );
      setBalances(bs);
    });
  }, []);

  const currentBalance = useMemo(() => {
    if (!watchUserId || !watchLeaveTypeId) return null;
    const empBalance = balances.find((b) => b.employee_id === watchUserId);
    if (!empBalance) return null;
    return empBalance.rows.find((r) => r.leave_type_id === watchLeaveTypeId) || null;
  }, [watchUserId, watchLeaveTypeId, balances]);

  const calculatedDays = useMemo(() => {
    if (watchDaysCount) return Number(watchDaysCount);
    if (watchDuration === 'half-day') return 0.5;
    if (watchDuration === 'hours') {
      const h = Number(watchHours || 0);
      return h > 0 ? h / 8 : 0;
    }
    if (watchDuration === 'multiple' && watchLeaveDate && watchEndDate) {
      const start = new Date(watchLeaveDate);
      const end = new Date(watchEndDate);
      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
      return 0;
    }
    return watchLeaveDate ? 1 : 0;
  }, [watchDaysCount, watchDuration, watchHours, watchLeaveDate, watchEndDate]);

  const exceedsQuota = currentBalance ? calculatedDays > currentBalance.remaining : false;

  const onSubmit = async (data: FormValues) => {
    startSave(async () => {
      const res = await saveLeave({
        user_id: data.userId,
        leave_type_id: data.leaveTypeId,
        duration: data.duration,
        half_day_type: data.duration === 'half-day' ? data.halfDayType : undefined,
        leave_date: data.leaveDate,
        end_date: data.duration === 'multiple' ? data.endDate : undefined,
        hours: data.duration === 'hours' ? Number(data.hours) : undefined,
        reason: data.reason,
        status: 'pending',
        applied_at: new Date(),
        days_count: calculatedDays,
      });
      if (!res.success) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      if (data.attachmentUrl && res.id) {
        await saveLeaveFile({
          leave_id: res.id,
          filename: data.attachmentName || 'attachment',
          url: data.attachmentUrl,
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
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-zoru-ink">Employee *</Label>
              <Controller
                name="userId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <ZoruSelectTrigger className={`mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px] ${errors.userId ? 'border-red-500' : ''}`}>
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
                )}
              />
              {errors.userId && (
                <p className="mt-1 text-[13px] text-red-500">{errors.userId.message}</p>
              )}
            </div>
            <div>
              <Label className="text-zoru-ink">Leave Type *</Label>
              <Controller
                name="leaveTypeId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <ZoruSelectTrigger className={`mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px] ${errors.leaveTypeId ? 'border-red-500' : ''}`}>
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
                )}
              />
              {errors.leaveTypeId && (
                <p className="mt-1 text-[13px] text-red-500">{errors.leaveTypeId.message}</p>
              )}
            </div>

            {currentBalance && (
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-bg p-3 text-[13px]">
                  <div className="flex-1 flex flex-col gap-1">
                    <div>
                      <span className="font-medium text-zoru-ink">Requested Days: </span>
                      <span className="text-zoru-ink-muted">
                        {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-zoru-ink">Remaining Balance: </span>
                      <span className="text-zoru-ink-muted">
                        {currentBalance.remaining} {currentBalance.remaining === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                  {exceedsQuota && (
                    <div className="flex items-center gap-1.5 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Requested days exceed available quota</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label className="text-zoru-ink">Duration</Label>
              <div className="mt-1.5">
                <Controller
                  name="duration"
                  control={control}
                  render={({ field }) => (
                    <EnumFormField
                      name="duration"
                      enumName="leaveDuration"
                      initialId={field.value}
                      onChange={(id) => field.onChange((id ?? 'full-day') as WsLeaveDuration)}
                      allowInlineCreate={false}
                    />
                  )}
                />
              </div>
            </div>

            {watchDuration === 'half-day' ? (
              <div>
                <Label className="text-zoru-ink">Half-day Type</Label>
                <div className="mt-1.5">
                  <Controller
                    name="halfDayType"
                    control={control}
                    render={({ field }) => (
                      <EnumFormField
                        name="halfDayType"
                        enumName="halfDayType"
                        initialId={field.value}
                        onChange={(id) => field.onChange((id ?? 'first-half') as WsHalfDayType)}
                        allowInlineCreate={false}
                      />
                    )}
                  />
                </div>
              </div>
            ) : null}

            <div>
              <Label className="text-zoru-ink">
                {watchDuration === 'multiple' ? 'Start Date *' : 'Leave Date *'}
              </Label>
              <Input
                type="date"
                {...register('leaveDate')}
                className={`mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px] ${errors.leaveDate ? 'border-red-500' : ''}`}
              />
              {errors.leaveDate && (
                <p className="mt-1 text-[13px] text-red-500">{errors.leaveDate.message}</p>
              )}
            </div>

            {watchDuration === 'multiple' ? (
              <div>
                <Label className="text-zoru-ink">End Date *</Label>
                <Input
                  type="date"
                  min={watchLeaveDate}
                  {...register('endDate')}
                  className={`mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px] ${errors.endDate ? 'border-red-500' : ''}`}
                />
                {errors.endDate && (
                  <p className="mt-1 text-[13px] text-red-500">{errors.endDate.message}</p>
                )}
              </div>
            ) : null}

            {watchDuration === 'hours' ? (
              <div>
                <Label className="text-zoru-ink">Hours *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  {...register('hours')}
                  className={`mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px] ${errors.hours ? 'border-red-500' : ''}`}
                />
                {errors.hours && (
                  <p className="mt-1 text-[13px] text-red-500">{errors.hours.message}</p>
                )}
              </div>
            ) : null}

            <div className="md:col-span-2">
              <Label className="text-zoru-ink">Reason</Label>
              <Textarea
                {...register('reason')}
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
                {...register('daysCount')}
                placeholder="Auto-calculated if left blank"
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div>
              <Label className="text-zoru-ink">Attachment Name</Label>
              <Input
                {...register('attachmentName')}
                placeholder="doctor-note.pdf"
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div>
              <Label className="text-zoru-ink">Attachment URL</Label>
              <div className="mt-1.5">
                <Controller
                  name="attachmentUrl"
                  control={control}
                  render={({ field }) => (
                    <SabFileUrlInput
                      accept="all"
                      value={field.value}
                      onChange={(v) => field.onChange(v)}
                      placeholder="https://…"
                    />
                  )}
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
                disabled={isSaving || exceedsQuota}
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
