'use client';

import { useTransition } from 'react';
import {
  Flame,
  Pause,
  Play,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  zoruToast,
} from '@/components/zoruui';
import {
  actionUpdateWarmupRun,
  type WarmupRunDoc,
} from '@/app/actions/email/deliverability.actions';
import { cn } from '@/components/zoruui/lib/cn';

interface WarmupScheduleProps {
  runs: WarmupRunDoc[];
  onUpdated: () => void;
}

function statusVariant(status: WarmupRunDoc['status']): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'cancelled':
      return 'destructive';
    case 'completed':
    default:
      return 'secondary';
  }
}

export function WarmupSchedule({ runs, onUpdated }: WarmupScheduleProps) {
  const [pending, startTransition] = useTransition();

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={<Flame />}
        title="No warmup in progress"
        description="Start a warmup to gradually ramp send volume on a new domain and build inbox trust."
      />
    );
  }

  const handleAction = (id: string, action: 'pause' | 'resume' | 'cancel') => {
    startTransition(async () => {
      const result = await actionUpdateWarmupRun(id, action);
      if (!result.ok) {
        zoruToast({ title: 'Warmup update failed', description: result.error, variant: 'destructive' });
        return;
      }
      zoruToast({ title: `Warmup ${action}d` });
      onUpdated();
    });
  };

  return (
    <div className="grid gap-4">
      {runs.map((run) => {
        const totalDays = run.schedule.length || 1;
        const progressPct = Math.min(100, Math.round((run.currentDay / totalDays) * 100));
        const peakCap = run.schedule.reduce((m, d) => Math.max(m, d.cap), 0) || 1;

        return (
          <Card key={run._id}>
            <ZoruCardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <ZoruCardTitle className="flex items-center gap-2">
                    <Flame className="h-4 w-4" /> {run.domain}
                  </ZoruCardTitle>
                  <ZoruCardDescription>
                    Day {run.currentDay} of {totalDays} · peak {peakCap.toLocaleString()} / day
                  </ZoruCardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                  {run.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(run._id, 'pause')}
                      disabled={pending}
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </Button>
                  ) : null}
                  {run.status === 'paused' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(run._id, 'resume')}
                      disabled={pending}
                    >
                      <Play className="h-3.5 w-3.5" /> Resume
                    </Button>
                  ) : null}
                  {run.status === 'active' || run.status === 'paused' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAction(run._id, 'cancel')}
                      disabled={pending}
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-zoru-surface-2">
                <div
                  className="h-full bg-zoru-primary transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="grid grid-cols-7 gap-1 sm:grid-cols-14">
                {run.schedule.map((d) => {
                  const isPast = d.day < run.currentDay;
                  const isCurrent = d.day === run.currentDay;
                  const height = Math.max(8, Math.round((d.cap / peakCap) * 56));
                  return (
                    <div key={d.day} className="flex flex-col items-center gap-1">
                      <div className="flex h-14 w-full items-end">
                        <div
                          className={cn(
                            'w-full rounded-sm transition-colors',
                            isCurrent && 'bg-zoru-primary',
                            isPast && 'bg-zoru-ink-muted/40',
                            !isPast && !isCurrent && 'bg-zoru-line',
                          )}
                          style={{ height }}
                          title={`Day ${d.day}: ${d.cap.toLocaleString()} sends`}
                        />
                      </div>
                      <span className="text-[10px] text-zoru-ink-muted">
                        {d.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ZoruCardContent>
          </Card>
        );
      })}
    </div>
  );
}
