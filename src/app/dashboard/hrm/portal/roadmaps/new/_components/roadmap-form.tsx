'use client';

import * as React from 'react';
import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { createRoadmap, type RoadmapPhase } from '@/app/actions/hrm-roadmaps.actions';
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
} from '@/components/sabcrm/20ui/compat';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';

function generateId() {
  return crypto.randomUUID();
}

export function RoadmapForm() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'active'>('draft');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [phases, setPhases] = useState<Array<{ id: string; name: string }>>([
    { id: generateId(), name: '' },
  ]);
  
  // Memoize phase handlers for performance
  const addPhase = useCallback(() => {
    setPhases((prev) => [...prev, { id: generateId(), name: '' }]);
  }, []);

  const removePhase = useCallback((id: string) => {
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePhaseName = useCallback((id: string, name: string) => {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  // Virtualizer for phases list (Performance enhancement)
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: phases.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // approximate height of each phase row
    overscan: 5,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title is required.',
        variant: 'destructive',
      });
      return;
    }

    const roadmapPhases: RoadmapPhase[] = phases
      .filter((p) => p.name.trim())
      .map((p) => ({ id: p.id, name: p.name.trim(), tasks: [] }));

    startTransition(async () => {
      const result = await createRoadmap({
        title: title.trim(),
        description: description.trim() || undefined,
        phases: roadmapPhases,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to create roadmap.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Roadmap created successfully.',
      });
      
      // Optimistic-like UI: router.push is fast enough but we show toast and leave button disabled
      router.push(`/dashboard/hrm/portal/roadmaps/${result.id}`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Back */}
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Roadmaps
      </button>

      <h1 className="mb-6 text-xl font-semibold text-[var(--st-text)]">New Roadmap</h1>

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
                invalid={!title.trim() && isPending}
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
                onValueChange={(v) => setStatus(v as 'draft' | 'active')}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                  <ZoruSelectItem value="active">Active</ZoruSelectItem>
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
              <Label>Initial Phases</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPhase}>
                <Plus />
                Add Phase
              </Button>
            </div>

            {phases.length === 0 ? (
              <p className="text-sm text-[var(--st-text-secondary)]">
                No phases yet — add at least one.
              </p>
            ) : (
              <div 
                ref={parentRef} 
                className="max-h-[300px] overflow-y-auto w-full pr-2 scrollbar-thin"
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const phase = phases[virtualRow.index];
                    return (
                      <div
                        key={phase.id}
                        className="absolute top-0 left-0 w-full pb-2"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="flex items-center gap-2 h-full">
                          <span className="w-5 text-xs text-[var(--st-text-tertiary)] tabular-nums">
                            {virtualRow.index + 1}.
                          </span>
                          <Input
                            placeholder={`Phase ${virtualRow.index + 1} name`}
                            value={phase.name}
                            onChange={(e) => updatePhaseName(phase.id, e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removePhase(phase.id)}
                            disabled={phases.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-[var(--st-text-secondary)]" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ZoruCardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Roadmap'}
          </Button>
        </div>
      </form>
    </div>
  );
}
