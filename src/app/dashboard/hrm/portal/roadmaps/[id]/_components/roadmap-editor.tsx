'use client';

import * as React from 'react';
import { useState, useTransition, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Archive, ArrowLeft, Download, Filter, CheckSquare } from 'lucide-react';

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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui/compat';
import { TaskCard } from './task-card';
import { AddTaskDrawer, type DirectReport } from './add-task-drawer';
import { PhaseHeader } from './phase-header';
import { useToast } from '@/hooks/use-toast';
import { fmtDate } from '@/lib/utils';

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
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Local state mirrors server data; optimistically updated before persist.
  const [phases, setPhases] = useState<RoadmapPhase[]>(roadmap.phases);
  const [dragging, setDragging] = useState<DragRef | null>(null);
  const [drawerPhaseId, setDrawerPhaseId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Filters & Bulk actions state
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);

  // Hydration state
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Mock WebSocket for collaborative editing
  useEffect(() => {
    // In a real application, this would connect to a WebSocket server
    // e.g. const ws = new WebSocket('wss://api.example.com/roadmaps/' + roadmap._id);
    const mockWsInterval = setInterval(() => {
      // Simulate receiving an event that someone is viewing the roadmap
      // console.log('[Mock WS] Ping connection active');
    }, 15000);
    return () => clearInterval(mockWsInterval);
  }, [roadmap._id]);

  /* ── Persist helpers ──────────────────────────────────────────────── */

  const persistPhases = useCallback(
    (next: RoadmapPhase[]) => {
      setSaveStatus('saving');
      startTransition(async () => {
        try {
          const res = await updateRoadmap(roadmap._id, { phases: next });
          if (!res.success) {
            toast({ title: 'Error', description: res.error || 'Failed to save', variant: 'destructive' });
            setSaveStatus('idle');
            return;
          }
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
          toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
          setSaveStatus('idle');
        }
      });
    },
    [roadmap._id, toast],
  );

  /* ── Phase actions ────────────────────────────────────────────────── */

  function handleAddPhase() {
    const next = [...phases, newPhase()];
    setPhases(next);
    persistPhases(next);
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
    toast({ title: 'Task Added', description: 'New task successfully added to phase.' });
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
      const res = await updateTaskStatus(roadmap._id, phaseId, taskId, 'done');
      if (!res.success) {
        toast({ title: 'Error', description: res.error || 'Failed to mark done', variant: 'destructive' });
      } else {
        toast({ title: 'Task Completed', description: 'Task has been marked as done.' });
      }
    });
  }

  /* ── Bulk Actions ─────────────────────────────────────────────────── */

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleBulkMarkDone = () => {
    if (selectedTasks.size === 0) return;
    
    // Optimistic UI update
    const next = phases.map((p) => ({
      ...p,
      tasks: p.tasks.map((t) =>
        selectedTasks.has(t.id) && t.status !== 'done'
          ? { ...t, status: 'done' as const, completedAt: new Date().toISOString() }
          : t
      ),
    }));
    
    setPhases(next);
    setSelectedTasks(new Set());
    setIsBulkMode(false);
    
    // Server persistence
    persistPhases(next);
    toast({ title: 'Bulk Update', description: 'Selected tasks marked as done.' });
  };

  /* ── Archive ──────────────────────────────────────────────────────── */

  function handleArchive() {
    startTransition(async () => {
      const res = await updateRoadmap(roadmap._id, { status: 'archived' });
      if (res.success) {
        toast({ title: 'Archived', description: 'Roadmap successfully archived.' });
        router.push('/dashboard/hrm/portal/roadmaps');
      } else {
        toast({ title: 'Error', description: 'Failed to archive.', variant: 'destructive' });
      }
    });
  }

  /* ── Save ─────────────────────────────────────────────────────────── */

  function handleSave() {
    persistPhases(phases);
  }

  /* ── Export ───────────────────────────────────────────────────────── */

  const handleExportCSV = () => {
    const rows = [
      ['Phase', 'Task Title', 'Assignee', 'Status', 'Priority', 'Due Date']
    ];
    phases.forEach((p) => {
      p.tasks.forEach((t) => {
        rows.push([
          `"${p.name.replace(/"/g, '""')}"`,
          `"${t.title.replace(/"/g, '""')}"`,
          `"${t.assigneeName || 'Unassigned'}"`,
          t.status,
          t.priority,
          t.dueDate ? fmtDate(t.dueDate) : '',
        ]);
      });
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `roadmap_export_${roadmap._id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Export Successful', description: 'Roadmap data exported to CSV.' });
  };

  /* ── Drag-and-drop ────────────────────────────────────────────────── */

  function handleDragStart(e: React.DragEvent, taskId: string, fromPhaseId: string) {
    if (isBulkMode) return; // Disable drag during bulk selection
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

  // Memoize filtering for performance
  const filteredPhases = useMemo(() => {
    return phases.map((p) => {
      const ft = p.tasks.filter((t) => {
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesAssignee = assigneeFilter === 'all' || (t.assigneeId === assigneeFilter) || (assigneeFilter === 'unassigned' && !t.assigneeId);
        return matchesSearch && matchesAssignee;
      });
      return { ...p, tasks: ft };
    });
  }, [phases, searchQuery, assigneeFilter]);

  // Unique assignees for filter
  const allAssignees = useMemo(() => {
    const set = new Map<string, string>();
    phases.forEach(p => p.tasks.forEach(t => {
      if (t.assigneeId && t.assigneeName) {
        set.set(t.assigneeId, t.assigneeName);
      }
    }));
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [phases]);

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-6 py-4">
        <button
          type="button"
          className="mr-1 inline-flex items-center gap-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          onClick={() => router.push('/dashboard/hrm/portal/roadmaps')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <h1 className="text-base font-semibold text-[var(--st-text)]">{roadmap.title}</h1>
        <Badge variant={STATUS_VARIANT[roadmap.status]}>{roadmap.status}</Badge>

        {mounted && (roadmap.startDate || roadmap.endDate) && (
          <span className="text-xs text-[var(--st-text-secondary)]">
            {roadmap.startDate
              ? fmtDate(roadmap.startDate)
              : '—'}
            {' → '}
            {roadmap.endDate
              ? fmtDate(roadmap.endDate)
              : '—'}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-xs text-[var(--st-text-secondary)]">Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-[var(--st-status-ok)]">Saved</span>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isPending}>
            <Save className="mr-1 h-4 w-4" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchive}
            disabled={isPending || roadmap.status === 'archived'}
          >
            <Archive className="mr-1 h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>

      {/* ── Toolbar (Filters & Bulk Actions) ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-6 py-2">
        <div className="flex items-center gap-2 relative">
          <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-tertiary)]" />
          <Input 
            placeholder="Search tasks..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 w-[200px]"
          />
        </div>
        
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="All Assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {allAssignees.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {isBulkMode ? (
            <>
              <span className="text-sm text-[var(--st-text-secondary)]">
                {selectedTasks.size} selected
              </span>
              <Button size="sm" variant="default" onClick={handleBulkMarkDone} disabled={selectedTasks.size === 0}>
                Mark Done
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setIsBulkMode(false); setSelectedTasks(new Set()); }}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setIsBulkMode(true)}>
              <CheckSquare className="mr-1 h-4 w-4" />
              Bulk Actions
            </Button>
          )}
        </div>
      </div>

      {/* ── Kanban board ── */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {filteredPhases.map((phase) => {
          const originalPhase = phases.find(p => p.id === phase.id)!;
          const pct = phasePct(originalPhase);
          const done = originalPhase.tasks.filter((t) => t.status === 'done').length;

          return (
            <div
              key={phase.id}
              className="flex w-72 shrink-0 flex-col rounded-[var(--zoru-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, phase.id)}
            >
              <PhaseHeader
                name={originalPhase.name}
                doneCount={done}
                totalCount={originalPhase.tasks.length}
                progressPercent={pct}
                onRename={(name) => handleRenamePhaseCommit(phase.id, name)}
              />

              {/* Task cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {phase.tasks.length === 0 && (
                  <p className="py-4 text-center text-xs text-[var(--st-text-tertiary)]">
                    No tasks yet
                  </p>
                )}
                {phase.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    draggable={!isBulkMode}
                    onDragStart={(e) => handleDragStart(e, task.id, phase.id)}
                    onMarkDone={() => handleMarkDone(phase.id, task.id)}
                    isDragging={dragging?.taskId === task.id}
                    showSelect={isBulkMode}
                    isSelected={selectedTasks.has(task.id)}
                    onToggleSelect={() => toggleTaskSelection(task.id)}
                  />
                ))}
              </div>

              {/* Add task button */}
              <div className="border-t border-[var(--st-border)] p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[var(--st-text-secondary)]"
                  onClick={() => setDrawerPhaseId(phase.id)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </div>
            </div>
          );
        })}

        {/* Add phase column */}
        <button
          type="button"
          onClick={handleAddPhase}
          className="flex h-fit w-64 shrink-0 items-center justify-center gap-2 rounded-[var(--zoru-radius-lg)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 px-4 py-6 text-sm text-[var(--st-text-secondary)] transition-colors hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
        >
          <Plus className="mr-2 h-4 w-4" />
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
