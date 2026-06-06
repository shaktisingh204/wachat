'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/zoruui/card";
import { Button } from "@/components/zoruui/button";
import { Badge } from "@/components/zoruui/badge";
import { useZoruToast } from "@/components/zoruui/use-zoru-toast";
import { punchInAction, punchOutAction } from '@/app/actions/crm/attendance.actions';
import { CrmAttendanceDoc } from '@/lib/rust-client/crm-attendance';

export default function AttendanceClient({
  employeeId,
  todayAttendance
}: {
  employeeId: string | null;
  todayAttendance: CrmAttendanceDoc | null;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useZoruToast();
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!employeeId) {
    return (
      <Card className="max-w-md mx-auto mt-10">
        <CardContent className="pt-6">
          <div className="text-center text-[var(--st-text)]">
            You do not have an employee profile linked to your account. Please contact your administrator.
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasPunchedIn = !!todayAttendance?.punchIn?.at;
  const hasPunchedOut = !!todayAttendance?.punchOut?.at;
  
  const handlePunchIn = async () => {
    setIsSubmitting(true);
    try {
      const at = new Date().toISOString();
      const res = await punchInAction({
         employeeId,
         at,
         source: 'web'
      });
      if (res.error) {
        toast({ title: 'Punch in failed', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Punched in successfully' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to punch in.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePunchOut = async () => {
    setIsSubmitting(true);
    try {
      const at = new Date().toISOString();
      const res = await punchOutAction({
         employeeId,
         at,
         source: 'web'
      });
      if (res.error) {
        toast({ title: 'Punch out failed', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Punched out successfully' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to punch out.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-2xl font-semibold">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </CardTitle>
        <p className="text-center text-zoru-text-soft text-sm">
          {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between border-b border-[var(--st-border)] pb-4">
          <div className="flex flex-col">
            <span className="text-sm text-zoru-text-soft">Status</span>
            <span className="font-medium">
              {hasPunchedOut ? 'Checked Out' : hasPunchedIn ? 'Checked In' : 'Not Checked In'}
            </span>
          </div>
          <div>
            {hasPunchedOut ? (
              <Badge variant="outline">Done</Badge>
            ) : hasPunchedIn ? (
              <Badge variant="default" className="bg-[var(--st-text)] hover:bg-[var(--st-text)]">Active</Badge>
            ) : (
              <Badge variant="outline">Idle</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            size="lg"
            variant="default"
            disabled={hasPunchedIn || isSubmitting}
            onClick={handlePunchIn}
            className="w-full"
          >
            Clock In
          </Button>
          <Button
            size="lg"
            variant="secondary"
            disabled={!hasPunchedIn || hasPunchedOut || isSubmitting}
            onClick={handlePunchOut}
            className="w-full"
          >
            Clock Out
          </Button>
        </div>

        {todayAttendance && (
           <div className="rounded-md bg-zoru-bg-[var(--st-bg-muted)] p-4 text-sm mt-4">
             <div className="flex justify-between mb-2">
               <span className="text-zoru-text-soft">Clock In:</span>
               <span className="font-medium">
                 {todayAttendance.punchIn?.at ? new Date(todayAttendance.punchIn.at).toLocaleTimeString() : '--'}
               </span>
             </div>
             <div className="flex justify-between">
               <span className="text-zoru-text-soft">Clock Out:</span>
               <span className="font-medium">
                 {todayAttendance.punchOut?.at ? new Date(todayAttendance.punchOut.at).toLocaleTimeString() : '--'}
               </span>
             </div>
           </div>
        )}
      </CardContent>
    </Card>
  );
}
