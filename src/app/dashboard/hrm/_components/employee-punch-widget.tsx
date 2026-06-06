'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Badge, Button, useToast } from '@/components/sabcrm/20ui/compat';
import { Clock, PlayCircle, StopCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { punchInAction, punchOutAction } from '@/app/actions/crm/attendance.actions';

interface EmployeePunchWidgetProps {
  employeeId: string;
  initialAttendance: any | null;
}

export function EmployeePunchWidget({ employeeId, initialAttendance }: EmployeePunchWidgetProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [attendance, setAttendance] = useState<any | null>(initialAttendance);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasPunchedIn = Boolean(attendance?.punchIn?.at);
  const hasPunchedOut = Boolean(attendance?.punchOut?.at);
  const isCurrentlyWorking = hasPunchedIn && !hasPunchedOut;

  const timeString = currentTime
    ? currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';
  const dateString = currentTime
    ? currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Loading';

  const handlePunchIn = () => {
    startTransition(async () => {
      try {
        const res = await punchInAction({ employeeId, source: 'web' });
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else if (res.record) {
          setAttendance(res.record);
          toast({ title: 'Punched in', description: 'Have a great shift.', variant: 'success' });
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      }
    });
  };

  const handlePunchOut = () => {
    startTransition(async () => {
      try {
        const res = await punchOutAction({ employeeId, source: 'web' });
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else if (res.record) {
          setAttendance(res.record);
          toast({ title: 'Punched out', description: 'Shift recorded.', variant: 'success' });
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      }
    });
  };

  const stateTone: 'green' | 'neutral' | 'amber' = isCurrentlyWorking
    ? 'green'
    : hasPunchedOut
      ? 'neutral'
      : 'amber';
  const stateLabel = isCurrentlyWorking ? 'On shift' : hasPunchedOut ? 'Completed' : 'Not started';

  return (
    <section
      aria-label="Punch widget"
      className="rounded-2xl border border-zinc-200 bg-white px-5 py-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200">
            <Clock className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone={stateTone} className="rounded-full px-2 py-0 text-[10px] uppercase tracking-wide">
                {stateLabel}
              </Badge>
              <span className="text-[11px] text-zinc-500">{dateString}</span>
            </div>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-zinc-900">
              {timeString}
            </p>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                In: <span className="font-mono text-zinc-900">
                  {hasPunchedIn
                    ? new Date(attendance.punchIn.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                Out: <span className="font-mono text-zinc-900">
                  {hasPunchedOut
                    ? new Date(attendance.punchOut.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          {isCurrentlyWorking ? (
            <Button
              size="sm"
              variant="destructive"
              className="h-9 rounded-full px-4 text-[12px] font-medium active:scale-[0.97]"
              onClick={handlePunchOut}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <StopCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              Punch out
            </Button>
          ) : hasPunchedOut ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1.5 ring-1 ring-zinc-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[12px] font-medium text-zinc-700">Shift finished</span>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-9 rounded-full px-4 text-[12px] font-medium active:scale-[0.97]"
              onClick={handlePunchIn}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              Punch in
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
