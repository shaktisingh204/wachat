'use client';

import * as React from 'react';
import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Archive, ArrowLeft } from 'lucide-react';

import {
  updateRoadmap,
  updateTaskStatus,
  type HrmRoadmap,
  type RoadmapPhase,
  type RoadmapTask,
} from '@/app/actions/hrm-roadmaps.actions';
import {
  Button,
  Badge,
  Progress,
  Input,
} from '@/components/zoruui';
import { TaskCard } from './task-card';
import { AddTaskDrawer, type DirectReport } from './add-task-drawer';

/* ─── Helpers ───────────────────────────────────────────────────────── */

const STATUS_VARIANT: Record<
  HrmRoadmap['status'],
  'secondary' | 'info' | 'success' | 'ghost'
> = {
  draft: 'secondary',
  active: 'info',
  completed: 'success',
  archived: 'ghost',
};

function phasePct(phase: RoadmapPhase) {
  const total = phase.tasks.length;
  if (total === 0) return 0;
  const done = phase.tasks.filter((t) => t.status === 'done').length;
  return Math.round((done / total) * 100);
}

function newPhase(): RoadmapPhase {
  return { id: crypto.randomUUID(), name: 'New Phase', tasks: [] };
}

/* ─── Drag state ────────────────────────────────────────────────────── */

interface DragRef {
  taskId: string;
  fromPhaseId: string;
}

/* ─── Props ─────────────────────────────────────────────────────────── */

export interface RoadmapEditorProps {
  roadmap: HrmRoadmap;
  directReports: DirectReport[];
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function RoadmapEditor({ roadmap, directReports }: RoadmapEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local state mirrors server data; optimistically updated before persist.
  const [phases, setPhases] = useState<RoadmapPhase[]>(roadmap.phases);
  const [dragging, setDragging] = useState<DragRef | null>(null);
  const [drawerPhaseId, setDrawerPhaseId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  /* ── Persist helpers ──────────────────────────────────────────────── */

  const persistPhases = useCallback(
    (next: RoadmapPhase[]) => {
      setSaveStatus('saving');
      startTransition(async () => {
        await updateRoadmap(roadmap._id, { phases: next });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      });
    },
    [roadmap._id],
  );

  /* ── Phase actions ────────────────────────────────────────────────── */

  function handleAddPhase() {
    const next = [...phases, newPhase()];
    setPhases(next);
    persistPhases(next);
  }

  function handleRenamePhase(phaseId: string, name: string) {
    setPhases((prev) =>
      prev.map((p) => (p.id === phaseId ? { ...p, name } : p)),
    );
  }

  function handleRenamePhaseCommit(phaseId: string, name: string) {
    const next = phases.map((p) =>
      p.id === phaseId ? { ...p, name: name.trim() || p.name } : p,
    );
    setPhases(next);
    persistPhases(next);
  }

  /* ── Task actions ─────────────────────────────────────────────────── */

  function handleAddTask(phaseId: string, task: Omit<RoadmapTask, 'id'>) {
    const newTask: RoadmapTask = { ...task, id: crypto.randomUUID() };
    const next = phases.map((p) =>
      p.id === phaseId ? { ...p, tasks: [...p.tasks, newTask] } : p,
    );
    setPhases(next);
    persistPhases(next);
    setDrawerPhaseId(null);
  }

  function handleMarkDone(phaseId: string, taskId: string) {
    // Optimistically update local state
    setPhases((prev) =>
      prev.map((p) =>
        p.id !== phaseId
          ? p
          : {
              ...p,
              tasks: p.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, status: 'done' as const, completedAt: new Date().toISOString() }
                  : t,
              ),
            },
      ),
    );
    // Persist + auto-report via server action
    startTransition(async () => {
      await updateTaskStatus(roadmap._id, phaseId, taskId, 'done');
    });
  }

  /* ── Archive ──────────────────────────────────────────────────────── */

  function handleArchive() {
    startTransition(async () => {
      await updateRoadmap(roadmap._id, { status: 'archived' });
      router.push('/dashboard/hrm/portal/roadmaps');
    });
  }

  /* ── Save ─────────────────────────────────────────────────────────── */

  function handleSave() {
    persistPhases(phases);
  }

  /* ── Drag-and-drop ────────────────────────────────────────────────── */

  function handleDragStart(e: React.DragEvent, taskId: string, fromPhaseId: string) {
    setDragging({ taskId, fromPhaseId });
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent, toPhaseId: string) {
    e.preventDefault();
    if (!dragging || dragging.fromPhaseId === toPhaseId) {
      setDragging(null);
      return;
    }

    let movedTask: RoadmapTask | undefined;
    const next = phases.map((p) => {
      if (p.id === dragging.fromPhaseId) {
        const filtered = p.tasks.filter((t) => {
          if (t.id === dragging.taskId) {
            movedTask = t;
            return false;
          }
          return true;
        });
        return { ...p, tasks: filtered };
      }
      return p;
    });

    if (movedTask) {
      const withDrop = next.map((p) =>
        p.id === toPhaseId ? { ...p, tasks: [...p.tasks, movedTask!] } : p,
      );
      setPhases(withDrop);
      persistPhases(withDrop);
    }

    setDragging(null);
  }

  /* ── Render ───────────────────────────────────────────────────────── */

  const activeDrawerPhase = phases.find((p) => p.id === drawerPhaseId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line bg-zoru-bg px-6 py-4">
        <button
          type="button"
          className="mr-1 inline-flex items-center gap-1 text-sm text-zoru-ink-muted hover:text-zoru-ink"
          onClick={() => router.push('/dashboard/hrm/portal/roadmaps')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <h1 className="text-base font-semibold text-zoru-ink">{roadmap.title}</h1>
        <ZoruBadge variant={STATUS_VARIANT[roadmap.status]}>{roadmap.status}</ZoruBadge>

        {(roadmap.startDate || roadmap.endDate) && (
          <span className="text-xs text-zoru-ink-muted">
            {roadmap.startDate
              ? new Date(roadmap.startDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
            {' → '}
            {roadmap.endDate
              ? new Date(roadmap.endDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-xs text-zoru-ink-muted">Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-zoru-success-ink">Saved</span>
          )}
          <ZoruButton variant="outline" size="sm" onClick={handleSave} disabled={isPending}>
            <Save />
            Save
          </ZoruButton>
          <ZoruButton
            variant="ghost"
            size="sm"
            onClick={handleArchive}
            disabled={isPending || roadmap.status === 'archived'}
          >
            <Archive />
            Archive
          </ZoruButton>
        </div>
      </div>

      {/* ── Kanban board ── */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {phases.map((phase) => {
          const pct = phasePct(phase);
          const done = phase.tasks.filter((t) => t.status === 'done').length;

          return (
            <div
              key={phase.id}
              className="flex w-72 shrink-0 flex-col rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, phase.id)}
            >
              {/* Column header */}
              <div className="flex flex-col gap-2 border-b border-zoru-line px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <ZoruInput
                    value={phase.name}
                    onChange={(e) => handleRenamePhase(phase.id, e.target.value)}
                    onBlur={(e) => handleRenamePhaseCommit(phase.id, e.target.value)}
                    className="h-7 border-transparent bg-transparent px-1 text-sm font-semibold shadow-none hover:border-zoru-line focus-visible:border-zoru-ink"
                  />
                  <span className="shrink-0 text-xs text-zoru-ink-muted tabular-nums">
                    {done}/{phase.tasks.length}
                  </span>
                </div>
                <ZoruProgress value={pct} className="h-1.5" />
              </div>

              {/* Task cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {phase.tasks.length === 0 && (
                  <p className="py-4 text-center text-xs text-zoru-ink-subtle">
                    No tasks yet
                  </p>
                )}
                {phase.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id, phase.id)}
                    onMarkDone={() => handleMarkDone(phase.id, task.id)}
                    isDragging={dragging?.taskId === task.id}
                  />
                ))}
              </div>

              {/* Add task button */}
              <div className="border-t border-zoru-line p-3">
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-zoru-ink-muted"
                  onClick={() => setDrawerPhaseId(phase.id)}
                >
                  <Plus className="h-4 w-4" />
                  Add Task
                </ZoruButton>
              </div>
            </div>
          );
        })}

        {/* Add phase column */}
        <button
          type="button"
          onClick={handleAddPhase}
          className="flex h-fit w-64 shrink-0 items-center justify-center gap-2 rounded-[var(--zoru-radius-lg)] border border-dashed border-zoru-line bg-zoru-surface/50 px-4 py-6 text-sm text-zoru-ink-muted transition-colors hover:border-zoru-line-strong hover:bg-zoru-surface hover:text-zoru-ink"
        >
          <Plus className="h-4 w-4" />
          Add Phase
        </button>
      </div>

      {/* ── Add Task Drawer ── */}
      {activeDrawerPhase && (
        <AddTaskDrawer
          open={drawerPhaseId !== null}
          onOpenChange={(open) => { if (!open) setDrawerPhaseId(null); }}
          directReports={directReports}
          onAdd={(task) => handleAddTask(activeDrawerPhase.id, task)}
        />
      )}
    </div>
  );
}
