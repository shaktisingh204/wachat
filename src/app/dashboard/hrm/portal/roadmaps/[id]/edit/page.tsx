'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowLeft, LoaderCircle } from 'lucide-react';

import {
  getRoadmapById,
  updateRoadmap,
  type RoadmapPhase,
  type RoadmapTask,
} from '@/app/actions/hrm-roadmaps.actions';
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
} from '@/components/zoruui';

type RoadmapStatus = 'draft' | 'active' | 'completed' | 'archived';

/** Local phase shape — keeps the original `tasks` so editing names is safe. */
type PhaseDraft = { id: string; name: string; tasks: RoadmapTask[] };

function generateId() {
  return crypto.randomUUID();
}

export default function EditRoadmapPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [isLoading, startLoad] = useTransition();
  const [isPending, startTransition] = useTransition();
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<RoadmapStatus>('draft');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [phases, setPhases] = useState<PhaseDraft[]>([]);

  useEffect(() => {
    startLoad(async () => {
      const roadmap = await getRoadmapById(id);
      if (!roadmap) {
        setLoadFailed(true);
        return;
      }
      setTitle(roadmap.title ?? '');
      setDescription(roadmap.description ?? '');
      setStatus((roadmap.status as RoadmapStatus) ?? 'draft');
      setStartDate(roadmap.startDate ? roadmap.startDate.slice(0, 10) : '');
      setEndDate(roadmap.endDate ? roadmap.endDate.slice(0, 10) : '');
      setPhases(
        (roadmap.phases ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          tasks: p.tasks ?? [],
        })),
      );
      setLoaded(true);
    });
  }, [id]);

  function addPhase() {
    setPhases((prev) => [...prev, { id: generateId(), name: '', tasks: [] }]);
  }

  function removePhase(phaseId: string) {
    setPhases((prev) => prev.filter((p) => p.id !== phaseId));
  }

  function updatePhaseName(phaseId: string, name: string) {
    setPhases((prev) =>
      prev.map((p) => (p.id === phaseId ? { ...p, name } : p)),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
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
        setError(result.error ?? 'Failed to update roadmap.');
        return;
      }

      router.push(`/dashboard/hrm/portal/roadmaps/${id}`);
    });
  }

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <button
          type="button"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zoru-ink-muted hover:text-zoru-ink"
          onClick={() => router.push('/dashboard/hrm/portal/roadmaps')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Roadmaps
        </button>
        <p className="text-sm text-zoru-ink-muted">
          This roadmap could not be found.
        </p>
      </div>
    );
  }

  if (isLoading && !loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Back */}
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zoru-ink-muted hover:text-zoru-ink"
        onClick={() => router.push(`/dashboard/hrm/portal/roadmaps/${id}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Roadmap
      </button>

      <h1 className="mb-6 text-xl font-semibold text-zoru-ink">Edit Roadmap</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as RoadmapStatus)}
              >
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

        {/* Phases */}
        <Card>
          <ZoruCardContent className="flex flex-col gap-4 pt-5">
            <div className="flex items-center justify-between">
              <Label>Phases</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPhase}
              >
                <Plus />
                Add Phase
              </Button>
            </div>

            {phases.length === 0 ? (
              <p className="text-sm text-zoru-ink-muted">
                No phases yet — add at least one.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {phases.map((phase, idx) => (
                  <div key={phase.id} className="flex items-center gap-2">
                    <span className="w-5 text-xs tabular-nums text-zoru-ink-subtle">
                      {idx + 1}.
                    </span>
                    <Input
                      placeholder={`Phase ${idx + 1} name`}
                      value={phase.name}
                      onChange={(e) =>
                        updatePhaseName(phase.id, e.target.value)
                      }
                      className="flex-1"
                    />
                    {phase.tasks.length > 0 && (
                      <span className="whitespace-nowrap text-xs text-zoru-ink-muted">
                        {phase.tasks.length} task
                        {phase.tasks.length === 1 ? '' : 's'}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removePhase(phase.id)}
                    >
                      <Trash2 className="h-4 w-4 text-zoru-ink-muted" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-zoru-ink-muted">
              Removing a phase also removes any tasks inside it.
            </p>
          </ZoruCardContent>
        </Card>

        {/* Error */}
        {error && <p className="text-sm text-zoru-danger">{error}</p>}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/hrm/portal/roadmaps/${id}`)
            }
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
