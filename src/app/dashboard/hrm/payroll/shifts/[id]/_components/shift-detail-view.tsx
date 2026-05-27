'use client';

import * as React from 'react';
import { useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { useZoruToast, Button, Badge } from '@/components/zoruui';
import { Edit, ArrowLeft, Clock, Users, Calendar, Info, BellRing } from 'lucide-react';
import type { CrmShiftDoc, CrmShiftStatus } from '@/lib/rust-client/crm-shifts';
import { useShiftWebsocket } from './use-shift-websocket';
import { AssignedEmployeesList } from './assigned-employees-list';
import { ShiftEditForm } from './shift-edit-form';

export function ShiftDetailView({ initialShift }: { initialShift: CrmShiftDoc }) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const { shift: wsShift, isConnected, lastModifiedBy } = useShiftWebsocket(initialShift);

  const [optimisticShift, addOptimisticUpdate] = useOptimistic<CrmShiftDoc, Partial<CrmShiftDoc>>(
    wsShift,
    (state, optimisticValue) => ({ ...state, ...optimisticValue })
  );

  const status = (optimisticShift.status ?? 'active') as CrmShiftStatus;
  
  // Hydration safe formatting (dates)
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const formatTime = (time: string) => {
    if (!mounted) return time; // SSR fallback
    const [h, m] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(h, 10));
    date.setMinutes(parseInt(m, 10));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const dayBadges = (days: string[] | undefined) => {
    const list = days ?? [];
    if (list.length === 0) return <span>—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {list.map((d) => (
          <Badge key={d} variant="info">
            {d.slice(0, 3)}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-1 items-center gap-3">
            <h1 className="text-2xl font-semibold text-zoru-ink">{optimisticShift.name}</h1>
            <Badge variant={status === 'active' ? 'success' : 'secondary'}>{status}</Badge>
            {isConnected && (
              <Badge variant="success" className="ml-2 animate-pulse">
                Live
              </Badge>
            )}
          </div>
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" /> Edit Shift
          </Button>
        </div>

        {lastModifiedBy && (
          <div className="flex items-center gap-2 rounded-md bg-zoru-surface-2 px-4 py-2 text-sm text-zoru-ink dark:bg-zoru-ink/20 dark:text-zoru-ink-muted">
            <BellRing className="h-4 w-4" />
            <span>Updates received from {lastModifiedBy} (Collaborative Editing)</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zoru-line p-4">
            <div className="flex items-center gap-2 text-zoru-ink-muted">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Window</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-zoru-ink">
              {formatTime(optimisticShift.startTime)} – {formatTime(optimisticShift.endTime)}
            </p>
            <p className="text-xs text-zoru-ink-muted">
              {optimisticShift.breakMinutes ?? 0}m break • {optimisticShift.graceMinutes ?? 0}m grace
            </p>
          </div>
          <div className="rounded-lg border border-zoru-line p-4">
            <div className="flex items-center gap-2 text-zoru-ink-muted">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Working Days</span>
            </div>
            <div className="mt-2">{dayBadges(optimisticShift.workingDays)}</div>
            <p className="mt-1 text-xs text-zoru-ink-muted">
              {optimisticShift.isNightShift ? 'Crosses midnight' : 'Day shift'}
            </p>
          </div>
          <div className="rounded-lg border border-zoru-line p-4">
            <div className="flex items-center gap-2 text-zoru-ink-muted">
              <Info className="h-4 w-4" />
              <span className="text-sm font-medium">Details</span>
            </div>
            <p className="mt-2 text-sm font-medium text-zoru-ink">
              Code: <span className="font-mono font-normal">{optimisticShift.code || 'None'}</span>
            </p>
            <div className="mt-1 flex items-center gap-2 text-sm">
              Color: 
              <span 
                className="inline-block h-3 w-3 rounded-full border border-zoru-line" 
                style={{ backgroundColor: optimisticShift.color || '#EAB308' }} 
              />
            </div>
          </div>
          <div className="rounded-lg border border-zoru-line p-4">
            <div className="flex items-center gap-2 text-zoru-ink-muted">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Assignments</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-zoru-ink">5,000</p>
            <p className="text-xs text-zoru-ink-muted">Active employees</p>
          </div>
        </div>
      </div>

      <AssignedEmployeesList shiftId={optimisticShift._id} />

      <ShiftEditForm 
        open={isEditing} 
        onOpenChange={setIsEditing} 
        initial={optimisticShift}
        onOptimisticUpdate={addOptimisticUpdate}
      />
    </div>
  );
}
