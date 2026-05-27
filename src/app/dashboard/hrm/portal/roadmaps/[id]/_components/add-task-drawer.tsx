'use client';

import * as React from 'react';
import { useState } from 'react';

import {
  Sheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetFooter,
  ZoruSheetClose,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
} from '@/components/zoruui';
import type { RoadmapTask } from '@/app/actions/hrm-roadmaps.actions.types';
export interface DirectReport {
  _id: string;
  name: string;
}

interface AddTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  directReports: DirectReport[];
  onAdd: (task: Omit<RoadmapTask, 'id'>) => void;
}

function emptyDraft(): Omit<RoadmapTask, 'id'> {
  return {
    title: '',
    description: '',
    assigneeId: undefined,
    assigneeName: undefined,
    startDate: undefined,
    dueDate: undefined,
    priority: 'medium',
    status: 'todo',
  };
}

export function AddTaskDrawer({
  open,
  onOpenChange,
  directReports,
  onAdd,
}: AddTaskDrawerProps) {
  const [draft, setDraft] = useState<Omit<RoadmapTask, 'id'>>(emptyDraft);
  const [titleError, setTitleError] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setDraft(emptyDraft());
      setTitleError(false);
    }
    onOpenChange(next);
  }

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleAssigneeChange(id: string) {
    const rep = directReports.find((r) => r._id === id);
    setDraft((prev) => ({
      ...prev,
      assigneeId: rep?._id,
      assigneeName: rep?.name,
    }));
  }

  function handleSubmit() {
    if (!draft.title.trim()) {
      setTitleError(true);
      return;
    }
    onAdd({ ...draft, title: draft.title.trim() });
    handleOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <ZoruSheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <ZoruSheetHeader className="mb-4">
          <ZoruSheetTitle>Add Task</ZoruSheetTitle>
        </ZoruSheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label required>Title</Label>
            <Input
              placeholder="Task title"
              value={draft.title}
              invalid={titleError}
              onChange={(e) => {
                set('title', e.target.value);
                if (e.target.value.trim()) setTitleError(false);
              }}
            />
            {titleError && (
              <p className="text-xs text-zoru-danger">Title is required.</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Optional details…"
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Assignee */}
          {directReports.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Assignee</Label>
              <Select
                value={draft.assigneeId ?? ''}
                onValueChange={handleAssigneeChange}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select employee" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {directReports.map((r) => (
                    <ZoruSelectItem key={r._id} value={r._id}>
                      {r.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={draft.startDate ?? ''}
                onChange={(e) => set('startDate', e.target.value || undefined)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={draft.dueDate ?? ''}
                onChange={(e) => set('dueDate', e.target.value || undefined)}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select
              value={draft.priority}
              onValueChange={(v) => set('priority', v as RoadmapTask['priority'])}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="low">Low</ZoruSelectItem>
                <ZoruSelectItem value="medium">Medium</ZoruSelectItem>
                <ZoruSelectItem value="high">High</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => set('status', v as RoadmapTask['status'])}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="todo">To Do</ZoruSelectItem>
                <ZoruSelectItem value="in_progress">In Progress</ZoruSelectItem>
                <ZoruSelectItem value="done">Done</ZoruSelectItem>
                <ZoruSelectItem value="blocked">Blocked</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
        </div>

        <ZoruSheetFooter>
          <ZoruSheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </ZoruSheetClose>
          <Button onClick={handleSubmit}>Add Task</Button>
        </ZoruSheetFooter>
      </ZoruSheetContent>
    </Sheet>
  );
}
