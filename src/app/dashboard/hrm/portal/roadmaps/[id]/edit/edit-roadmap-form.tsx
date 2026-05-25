'use client';

import * as React from 'react';
import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateRoadmap } from '@/app/actions/hrm-roadmaps.actions';
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  ZoruCardContent,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  useZoruToast,
  ZoruToastAction,
} from '@/components/zoruui';
import { Users } from 'lucide-react';
import BasicInfoForm from './basic-info-form';
import PhaseList, { type PhaseDraft } from './phase-list';
import type { HrmRoadmap, RoadmapPhase } from '@/app/actions/hrm-roadmaps.actions';

type RoadmapStatus = 'draft' | 'active' | 'completed' | 'archived';

interface EditRoadmapFormProps {
  initialRoadmap: HrmRoadmap;
  id: string;
}

export default function EditRoadmapForm({ initialRoadmap, id }: EditRoadmapFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initialRoadmap.title ?? '');
  const [description, setDescription] = useState(initialRoadmap.description ?? '');
  const [status, setStatus] = useState<RoadmapStatus>((initialRoadmap.status as RoadmapStatus) ?? 'draft');
  const [startDate, setStartDate] = useState(initialRoadmap.startDate ?? '');
  const [endDate, setEndDate] = useState(initialRoadmap.endDate ?? '');

  const [phases, setPhases] = useState<PhaseDraft[]>(
    (initialRoadmap.phases ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      tasks: p.tasks ?? [],
    }))
  );

  const [error, setError] = useState<string | null>(null);
  
  // Real-time collaborative editing mock
  const [collaborators, setCollaborators] = useState<number>(0);

  const clientId = React.useRef(`client-${Math.random().toString(36).substring(2, 9)}`);
  const wsRef = React.useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket('wss://echo.websocket.events');
    wsRef.current = ws;

    ws.onopen = () => {
      // Broadcast join event
      ws.send(JSON.stringify({ type: 'JOIN_ROADMAP', roadmapId: id, clientId: clientId.current }));
      setCollaborators(Math.floor(Math.random() * 3) + 1); // Mock other users
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.roadmapId === id && data.clientId !== clientId.current) {
          if (data.type === 'UPDATE_FIELD') {
            if (data.field === 'title') setTitle(data.value);
            if (data.field === 'description') setDescription(data.value);
            if (data.field === 'status') setStatus(data.value);
            if (data.field === 'startDate') setStartDate(data.value);
            if (data.field === 'endDate') setEndDate(data.value);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [id]);

  const handleFieldChange = (field: string, value: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'UPDATE_FIELD', roadmapId: id, clientId: clientId.current, field, value }));
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      const msg = 'Title is required.';
      setError(msg);
      toast({ title: 'Validation Error', description: msg, variant: 'destructive' });
      return;
    }

    // Drop blank phases but keep each surviving phase's tasks intact.
    const roadmapPhases: RoadmapPhase[] = phases
      .filter((p) => p.name.trim())
      .map((p) => ({ id: p.id, name: p.name.trim(), tasks: p.tasks }));

    startTransition(async () => {
      const result = await updateRoadmap(id, {
        title: title.trim(),
        description: description.trim() || undefined,
        phases: roadmapPhases,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (!result.success) {
        const errMsg = result.error ?? 'Failed to update roadmap.';
        setError(errMsg);
        toast({ 
          title: 'Update Failed', 
          description: errMsg, 
          variant: 'destructive',
          action: (
            <ZoruToastAction altText="Retry" onClick={(e: any) => handleSubmit(e)}>
              Retry
            </ZoruToastAction>
          )
        });
        return;
      }

      toast({ title: 'Success', description: 'Roadmap updated successfully.' });
      router.push(`/dashboard/hrm/portal/roadmaps/${id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {collaborators > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-zoru-brand/10 p-3 text-sm text-zoru-brand">
          <Users className="h-4 w-4" />
          <span>
            {collaborators} other user{collaborators > 1 ? 's are' : ' is'} currently viewing or editing this roadmap.
          </span>
        </div>
      )}

      {/* Basic info */}
      <BasicInfoForm
        title={title} setTitle={setTitle}
        description={description} setDescription={setDescription}
        status={status} setStatus={setStatus}
        startDate={startDate} setStartDate={setStartDate}
        endDate={endDate} setEndDate={setEndDate}
        handleFieldChange={handleFieldChange}
        error={error}
      />

      {/* Extracted Phase List Component */}
      <PhaseList phases={phases} setPhases={setPhases} />

      {/* Error */}
      {error && <p className="text-sm text-zoru-danger">{error}</p>}

      {/* Submit */}
      <div className="flex justify-end gap-3 print:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dashboard/hrm/portal/roadmaps/${id}`)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
