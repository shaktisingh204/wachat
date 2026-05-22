'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

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
} from '@/components/zoruui';

function generateId() {
  return crypto.randomUUID();
}

export default function NewRoadmapPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'active'>('draft');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [phases, setPhases] = useState<Array<{ id: string; name: string }>>([
    { id: generateId(), name: '' },
  ]);

  function addPhase() {
    setPhases((prev) => [...prev, { id: generateId(), name: '' }]);
  }

  function removePhase(id: string) {
    setPhases((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePhaseName(id: string, name: string) {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
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
        setError(result.error ?? 'Failed to create roadmap.');
        return;
      }

      router.push(`/dashboard/hrm/portal/roadmaps/${result.id}`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Back */}
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zoru-ink-muted hover:text-zoru-ink"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Roadmaps
      </button>

      <h1 className="mb-6 text-xl font-semibold text-zoru-ink">New Roadmap</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Basic info */}
        <ZoruCard>
          <ZoruCardContent className="flex flex-col gap-4 pt-5">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel required>Title</ZoruLabel>
              <ZoruInput
                placeholder="e.g. Q3 Product Launch"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                invalid={error !== null && !title.trim()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel>Description</ZoruLabel>
              <ZoruTextarea
                placeholder="What is this roadmap about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel>Status</ZoruLabel>
              <ZoruSelect
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
              </ZoruSelect>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel>Start Date</ZoruLabel>
                <ZoruInput
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel>End Date</ZoruLabel>
                <ZoruInput
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </ZoruCardContent>
        </ZoruCard>

        {/* Phases */}
        <ZoruCard>
          <ZoruCardContent className="flex flex-col gap-4 pt-5">
            <div className="flex items-center justify-between">
              <ZoruLabel>Initial Phases</ZoruLabel>
              <ZoruButton type="button" variant="outline" size="sm" onClick={addPhase}>
                <Plus />
                Add Phase
              </ZoruButton>
            </div>

            {phases.length === 0 ? (
              <p className="text-sm text-zoru-ink-muted">
                No phases yet — add at least one.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {phases.map((phase, idx) => (
                  <div key={phase.id} className="flex items-center gap-2">
                    <span className="w-5 text-xs text-zoru-ink-subtle tabular-nums">
                      {idx + 1}.
                    </span>
                    <ZoruInput
                      placeholder={`Phase ${idx + 1} name`}
                      value={phase.name}
                      onChange={(e) => updatePhaseName(phase.id, e.target.value)}
                      className="flex-1"
                    />
                    <ZoruButton
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removePhase(phase.id)}
                      disabled={phases.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-zoru-ink-muted" />
                    </ZoruButton>
                  </div>
                ))}
              </div>
            )}
          </ZoruCardContent>
        </ZoruCard>

        {/* Error */}
        {error && (
          <p className="text-sm text-zoru-danger">{error}</p>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <ZoruButton
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </ZoruButton>
          <ZoruButton type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Roadmap'}
          </ZoruButton>
        </div>
      </form>
    </div>
  );
}
