'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Card, Button, Badge, useZoruToast } from '@/components/zoruui';
import { Clock, PlayCircle, StopCircle, CheckCircle2 } from 'lucide-react';
import { punchInAction, punchOutAction } from '@/app/actions/crm/attendance.actions';

interface EmployeePunchWidgetProps {
  employeeId: string;
  initialAttendance: any | null;
}

export function EmployeePunchWidget({ employeeId, initialAttendance }: EmployeePunchWidgetProps) {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  
  // State from server
  const [attendance, setAttendance] = useState<any | null>(initialAttendance);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasPunchedIn = Boolean(attendance?.punchIn?.at);
  const hasPunchedOut = Boolean(attendance?.punchOut?.at);
  const isCurrentlyWorking = hasPunchedIn && !hasPunchedOut;

  // Formatting time display
  const timeString = currentTime ? currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
  const dateString = currentTime ? currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading...';

  const handlePunchIn = () => {
    startTransition(async () => {
      try {
        const res = await punchInAction({ employeeId, source: 'web' });
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else if (res.record) {
          setAttendance(res.record);
          toast({ title: 'Success', description: 'Punched in successfully.', variant: 'success' });
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
          toast({ title: 'Success', description: 'Punched out successfully.', variant: 'success' });
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      }
    });
  };

  return (
    <Card className="p-6 relative overflow-hidden bg-gradient-to-br from-zoru-bg to-zoru-surface-2 shadow-sm border border-zoru-line">
      {/* Decorative background element */}
      <div className="absolute right-[-20px] top-[-20px] opacity-[0.03]">
        <Clock className="w-48 h-48" />
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <div className="flex flex-col text-center md:text-left">
          <Badge tone={isCurrentlyWorking ? 'success' : hasPunchedOut ? 'neutral' : 'warning'} className="mb-2 self-center md:self-start w-fit">
            {isCurrentlyWorking ? 'ACTIVE SHIFT' : hasPunchedOut ? 'SHIFT COMPLETED' : 'NOT CLOCKED IN'}
          </Badge>
          <h2 className="text-[32px] font-bold tracking-tight text-zoru-ink font-mono mt-1">
            {timeString}
          </h2>
          <p className="text-[13px] text-zoru-ink-muted uppercase tracking-wider font-medium mt-1">
            {dateString}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-full md:w-auto">
          {isCurrentlyWorking ? (
            <Button
              size="lg"
              variant="destructive"
              className="w-full md:w-auto px-8 py-6 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
              onClick={handlePunchOut}
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2"><Clock className="w-5 h-5 animate-spin" /> Processing...</span>
              ) : (
                <span className="flex items-center gap-2"><StopCircle className="w-5 h-5" /> Punch Out</span>
              )}
            </Button>
          ) : hasPunchedOut ? (
            <div className="bg-zoru-surface border border-zoru-line rounded-xl p-4 flex items-center gap-3 w-full md:w-auto justify-center">
               <CheckCircle2 className="w-6 h-6 text-zoru-success-ink" />
               <div className="text-left">
                 <p className="text-[12px] text-zoru-ink font-bold uppercase tracking-wider">Shift Finished</p>
                 <p className="text-[11px] text-zoru-ink-muted mt-0.5">You're all set for today.</p>
               </div>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full md:w-auto px-8 py-6 rounded-xl font-bold bg-zoru-success-ink hover:bg-emerald-600 text-white shadow-md hover:shadow-lg transition-all"
              onClick={handlePunchIn}
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2"><Clock className="w-5 h-5 animate-spin" /> Processing...</span>
              ) : (
                <span className="flex items-center gap-2"><PlayCircle className="w-5 h-5" /> Punch In</span>
              )}
            </Button>
          )}

          {/* Quick stats below button */}
          <div className="flex items-center gap-4 text-[11px] font-medium text-zoru-ink-muted mt-2">
            <span className="flex items-center gap-1.5 bg-zoru-surface py-1 px-2.5 rounded-md border border-zoru-line">
              <span className="w-2 h-2 rounded-full bg-zoru-info-ink" />
              In: {hasPunchedIn ? new Date(attendance.punchIn.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </span>
            <span className="flex items-center gap-1.5 bg-zoru-surface py-1 px-2.5 rounded-md border border-zoru-line">
              <span className="w-2 h-2 rounded-full bg-zoru-ink-muted" />
              Out: {hasPunchedOut ? new Date(attendance.punchOut.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
