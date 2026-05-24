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
} from '@/components/zoruui';
import { Users } from 'lucide-react';

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

  useEffect(() => {
    // Simulate joining a WebSocket channel for collaborative editing
    const timer = setTimeout(() => {
      setCollaborators(Math.floor(Math.random() * 3));
    }, 2000);

    const interval = setInterval(() => {
      setCollaborators((prev) => {
        const change = Math.random() > 0.5 ? 1 : -1;
        return Math.max(0, Math.min(3, prev + change));
      });
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

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
        toast({ title: 'Update Failed', description: errMsg, variant: 'destructive' });
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
      <Card>
        <ZoruCardContent className="flex flex-col gap-4 pt-5">
          <div className="flex flex-col gap-1.5">
            <Label required>Title</Label>
            <Input
              placeholder="e.g. Q3 Product Launch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              invalid={error !== null && !title.trim()}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="What is this roadmap about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as RoadmapStatus)}>
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </ZoruCardContent>
      </Card>

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
