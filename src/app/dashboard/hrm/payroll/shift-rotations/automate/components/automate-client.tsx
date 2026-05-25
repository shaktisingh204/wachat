'use client';

import { useState, useTransition, useEffect, useOptimistic, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { runRotation, saveAutomateShift, getAutomateShifts, deleteAutomateShift } from '@/app/actions/worksuite/shifts.actions';
import type { WsShiftRotation, WsAutomateShift } from '@/lib/worksuite/shifts-types';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import AutomateForm from './automate-form';
import AutomateRuns from './automate-runs';

interface Props {
  initialRotations: WsShiftRotation[];
  initialEmployees: WithId<CrmEmployee>[];
  initialRuns: WsAutomateShift[];
}

export default function AutomateClient({ initialRotations, initialEmployees, initialRuns }: Props) {
  const [runs, setRuns] = useState<WsAutomateShift[]>(initialRuns);
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [optimisticRuns, dispatchOptimistic] = useOptimistic(
    runs,
    (state, action: { type: 'ADD'; payload: WsAutomateShift } | { type: 'DELETE'; payload: string[] }) => {
      if (action.type === 'ADD') return [action.payload, ...state];
      if (action.type === 'DELETE') return state.filter(r => !action.payload.includes(String(r._id)));
      return state;
    }
  );

  // Simulated WebSocket connection for real-time collaborative updates
  useEffect(() => {
    const ws = new WebSocket('wss://api.sabnode.com/ws/shifts/automate');
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_RUN') {
          setRuns(prev => [data.payload, ...prev]);
        } else if (data.type === 'UPDATE_RUN') {
          setRuns(prev => prev.map(r => String(r._id) === String(data.payload._id) ? data.payload : r));
        } else if (data.type === 'DELETE_RUNS') {
          setRuns(prev => prev.filter(r => !data.payload.includes(String(r._id))));
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleRun = async (rotationId: string, startDate: string, endDate: string, selectedEmps: Set<string>) => {
    if (!rotationId || !startDate || !endDate || selectedEmps.size === 0) {
      toast({ title: 'Error', description: 'Rotation, dates and at least one employee are required.', variant: 'destructive' });
      return;
    }

    const ids = Array.from(selectedEmps);
    const tempId = `temp-${Date.now()}`;
    const newRun: any = {
      _id: tempId,
      shift_rotation_id: rotationId,
      user_ids: ids,
      start_date: new Date(startDate),
      end_date: new Date(endDate),
      status: 'running',
    };

    startTransition(async () => {
      dispatchOptimistic({ type: 'ADD', payload: newRun });
      
      const save = await saveAutomateShift({
        shift_rotation_id: rotationId,
        user_ids: ids,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        status: 'running',
      });

      if (!save.success) {
        toast({ title: 'Error', description: save.error ?? 'Failed to save automation', variant: 'destructive' });
        return;
      }

      const res = await runRotation(rotationId, startDate, endDate, ids);
      
      if (!res.success) {
        toast({ title: 'Error', description: res.error ?? 'Failed to run rotation', variant: 'destructive' });
        // Optionally mark as failed
        await saveAutomateShift({ _id: save.data?._id as string, status: 'failed' });
      } else {
        toast({ title: 'Success', description: `Inserted ${res.data?.inserted ?? 0} schedule row(s) across ${res.data?.days ?? 0} day(s).` });
        // Mark as completed
        await saveAutomateShift({ _id: save.data?._id as string, status: 'completed' });
      }
      
      // Refresh real runs
      const updatedRuns = await getAutomateShifts();
      setRuns(updatedRuns);
    });
  };

  const handleDeleteRuns = useCallback((ids: string[]) => {
    startTransition(async () => {
      dispatchOptimistic({ type: 'DELETE', payload: ids });
      let successCount = 0;
      for (const id of ids) {
        if (id.startsWith('temp-')) continue;
        const res = await deleteAutomateShift(id);
        if (res.success) successCount++;
      }
      toast({
        title: 'Deleted',
        description: `Successfully deleted ${successCount} run(s).`,
      });
      const updatedRuns = await getAutomateShifts();
      setRuns(updatedRuns);
    });
  }, [toast, dispatchOptimistic]);

  return (
    <div className="flex flex-col gap-4">
      <AutomateForm
        rotations={initialRotations}
        employees={initialEmployees}
        onRun={handleRun}
        pending={pending}
      />
      <AutomateRuns runs={optimisticRuns} onDeleteRuns={handleDeleteRuns} />
    </div>
  );
}
