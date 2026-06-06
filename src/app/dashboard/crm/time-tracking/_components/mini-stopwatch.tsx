'use client';

import * as React from 'react';
import { Card, Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { Clock, Pause, Square } from 'lucide-react';
import { getTimeLogs, stopTimer } from '@/app/actions/worksuite/time.actions';
import type { WsProjectTimeLog } from '@/lib/worksuite/time-types';
import Link from 'next/link';

function LiveElapsed({ start }: { start: string | Date }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const d = new Date(start as any);
  if (isNaN(d.getTime())) return <span>00:00:00</span>;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="font-mono tabular-nums text-zoru-brand-ink font-semibold">
      {pad(hrs)}:{pad(mins)}:{pad(secs)}
    </span>
  );
}

export function MiniStopwatch() {
  const [runningLog, setRunningLog] = React.useState<WsProjectTimeLog | null>(null);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useZoruToast();

  const fetchRunning = React.useCallback(async () => {
    try {
      const logs = await getTimeLogs({ is_running: true });
      if (logs.length > 0) {
        setRunningLog(logs[0]);
      } else {
        setRunningLog(null);
      }
    } catch (err) {
      console.error('Failed to fetch running timer', err);
    }
  }, []);

  React.useEffect(() => {
    fetchRunning();
    const i = setInterval(fetchRunning, 10000); // refresh every 10s
    return () => clearInterval(i);
  }, [fetchRunning]);

  if (!runningLog) return null;

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await stopTimer(String(runningLog._id));
      if (res.ok) {
        toast({ title: 'Timer stopped' });
        setRunningLog(null);
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error stopping timer', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="fixed bottom-6 right-6 z-50 p-3 shadow-xl border-zoru-brand-line/50 bg-[var(--st-bg)] w-64 animate-in slide-in-from-bottom-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-zoru-brand-ink animate-pulse" />
          <span className="text-xs uppercase tracking-widest text-[var(--st-text-secondary)]">Active Timer</span>
        </div>
      </div>
      
      <Link href={`/dashboard/crm/time-tracking/time-logs/${runningLog._id}`} className="block mb-3 hover:underline">
        <div className="text-sm font-medium text-[var(--st-text)] truncate">
          {runningLog.memo || 'General Time Log'}
        </div>
      </Link>
      
      <div className="flex items-center justify-between">
        <LiveElapsed start={runningLog.start_time!} />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleStop}
          disabled={loading}
          className="h-7 px-2 text-[var(--st-danger)] border-[var(--st-danger)]/30 hover:bg-[var(--st-danger)]/10"
        >
          <Square className="w-3.5 h-3.5 mr-1 fill-current" />
          Stop
        </Button>
      </div>
    </Card>
  );
}
