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
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  cn,
  toast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
  actionUpdateWarmupRun,
  type WarmupRunDoc,
} from '@/app/actions/email/deliverability.actions';

interface WarmupScheduleProps {
  runs: WarmupRunDoc[];
  onUpdated: () => void;
}

function statusTone(status: WarmupRunDoc['status']): BadgeTone {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'cancelled':
      return 'danger';
    case 'completed':
    default:
      return 'neutral';
  }
}

export function WarmupSchedule({ runs, onUpdated }: WarmupScheduleProps) {
  const [pending, startTransition] = useTransition();

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Flame}
        title="No warmup in progress"
        description="Start a warmup to gradually ramp send volume on a new domain and build inbox trust."
      />
    );
  }

  const handleAction = (id: string, action: 'pause' | 'resume' | 'cancel') => {
    startTransition(async () => {
      const result = await actionUpdateWarmupRun(id, action);
      if (!result.ok) {
        toast.error({ title: 'Warmup update failed', description: result.error });
        return;
      }
      toast.success({ title: `Warmup ${action}d` });
      onUpdated();
    });
  };

  return (
    <div className="grid gap-4">
      {runs.map((run) => {
        const schedule = run.schedule ?? [];
        const totalDays = schedule.length || 1;
        const progressPct = Math.min(100, Math.round(((run.currentDay ?? 0) / totalDays) * 100));
        const peakCap = schedule.reduce((m, d) => Math.max(m, d.cap), 0) || 1;

        return (
          <Card key={run._id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-4 w-4" aria-hidden="true" /> {run.domain}
                  </CardTitle>
                  <CardDescription>
                    Day {run.currentDay} of {totalDays}, peak {peakCap.toLocaleString()} / day
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                  {run.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      iconLeft={Pause}
                      onClick={() => handleAction(run._id, 'pause')}
                      disabled={pending}
                    >
                      Pause
                    </Button>
                  ) : null}
                  {run.status === 'paused' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      iconLeft={Play}
                      onClick={() => handleAction(run._id, 'resume')}
                      disabled={pending}
                    >
                      Resume
                    </Button>
                  ) : null}
                  {run.status === 'active' || run.status === 'paused' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={X}
                      onClick={() => handleAction(run._id, 'cancel')}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <Progress
                value={progressPct}
                size="sm"
                className="mb-2"
                aria-label={`Warmup progress for ${run.domain}`}
              />
              <div className="grid grid-cols-7 gap-1 sm:grid-cols-14">
                {schedule.map((d) => {
                  const isPast = d.day < run.currentDay;
                  const isCurrent = d.day === run.currentDay;
                  const height = Math.max(8, Math.round((d.cap / peakCap) * 56));
                  return (
                    <div key={d.day} className="flex flex-col items-center gap-1">
                      <div className="flex h-14 w-full items-end">
                        <div
                          className={cn(
                            'w-full rounded-sm transition-colors',
                            isCurrent && 'bg-[var(--st-text)]',
                            isPast && 'bg-[var(--st-text-secondary)]/40',
                            !isPast && !isCurrent && 'bg-[var(--st-border)]',
                          )}
                          style={{ height }}
                          title={`Day ${d.day}: ${d.cap.toLocaleString()} sends`}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--st-text-secondary)]">
                        {d.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
