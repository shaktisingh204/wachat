'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  Copy,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  zoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  actionActivateEmailJourney,
  actionCloneEmailJourney,
  actionDeleteEmailJourney,
  actionPauseEmailJourney,
} from '@/app/actions/email/journeys.actions';
import type { EmailJourneyDoc, EmailJourneyStatus } from '@/lib/rust-client/email-journeys';

const STATUS_VARIANTS: Record<EmailJourneyStatus, 'default' | 'secondary' | 'outline'> = {
  draft: 'outline',
  active: 'default',
  paused: 'secondary',
  archived: 'outline',
};

interface JourneyListProps {
  journeys: EmailJourneyDoc[];
  onChanged: () => void;
}

export function JourneyList({ journeys, onChanged }: JourneyListProps) {
  const handleActivate = async (j: EmailJourneyDoc) => {
    const r = await actionActivateEmailJourney(j._id);
    if (!r.ok) { zoruToast({ title: 'Activate failed', description: r.error, variant: 'destructive' }); return; }
    zoruToast({ title: `Journey "${j.name}" activated` });
    onChanged();
  };
  const handlePause = async (j: EmailJourneyDoc) => {
    const r = await actionPauseEmailJourney(j._id);
    if (!r.ok) { zoruToast({ title: 'Pause failed', description: r.error, variant: 'destructive' }); return; }
    zoruToast({ title: `Journey "${j.name}" paused` });
    onChanged();
  };
  const handleClone = async (j: EmailJourneyDoc) => {
    const r = await actionCloneEmailJourney(j._id);
    if (!r.ok) { zoruToast({ title: 'Clone failed', description: r.error, variant: 'destructive' }); return; }
    zoruToast({ title: `Cloned as "${r.data.name}"` });
    onChanged();
  };
  const handleDelete = async (j: EmailJourneyDoc) => {
    const r = await actionDeleteEmailJourney(j._id);
    if (!r.ok) { zoruToast({ title: 'Delete failed', description: r.error, variant: 'destructive' }); return; }
    zoruToast({ title: 'Journey deleted' });
    onChanged();
  };

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {journeys.map((j) => {
        const entered = j.stats?.entered ?? 0;
        const active = j.stats?.active ?? 0;
        const completed = j.stats?.completed ?? 0;
        const updated = j.updatedAt ? formatDistanceToNow(new Date(j.updatedAt), { addSuffix: true }) : '—';
        return (
          <Card key={j._id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/email/journeys/${j._id}`}
                  className="font-medium hover:underline truncate block"
                >
                  {j.name}
                </Link>
                {j.description ? (
                  <p className="text-xs text-zoru-ink-muted line-clamp-2 mt-1">{j.description}</p>
                ) : null}
              </div>
              <DropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Journey actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                  <ZoruDropdownMenuItem asChild>
                    <Link href={`/dashboard/email/journeys/${j._id}`}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Link>
                  </ZoruDropdownMenuItem>
                  {j.status === 'draft' || j.status === 'paused' ? (
                    <ZoruDropdownMenuItem onSelect={() => handleActivate(j)}>
                      <Play className="h-4 w-4" /> Activate
                    </ZoruDropdownMenuItem>
                  ) : null}
                  {j.status === 'active' ? (
                    <ZoruDropdownMenuItem onSelect={() => handlePause(j)}>
                      <Pause className="h-4 w-4" /> Pause
                    </ZoruDropdownMenuItem>
                  ) : null}
                  <ZoruDropdownMenuItem onSelect={() => handleClone(j)}>
                    <Copy className="h-4 w-4" /> Clone
                  </ZoruDropdownMenuItem>
                  <ZoruDropdownMenuItem onSelect={() => handleDelete(j)} className="text-zoru-ink">
                    <Trash2 className="h-4 w-4" /> Delete
                  </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANTS[j.status] ?? 'outline'}>{j.status}</Badge>
              <span className="text-xs text-zoru-ink-muted">Edited {updated}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <KpiCell icon={<Users className="h-3 w-3" />} label="Entered" value={entered} />
              <KpiCell icon={<Play className="h-3 w-3" />} label="Active" value={active} />
              <KpiCell icon={<CheckCircle2 className="h-3 w-3" />} label="Completed" value={completed} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function KpiCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-zoru-line bg-zoru-surface-2 p-2">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-zoru-ink-muted">
        {icon} {label}
      </span>
      <span className="text-sm font-medium tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}
