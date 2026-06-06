'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from '@/components/sabcrm/20ui';
import {
  LoaderCircle,
  Play } from 'lucide-react';

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';

export interface StartTimerForm {
  project_id: string;
  task_id: string;
  memo: string;
}

interface StartTimerDialogProps {
  open: boolean;
  busy: boolean;
  form: StartTimerForm;
  onFormChange: (next: StartTimerForm) => void;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
}

export function StartTimerDialog({
  open,
  busy,
  form,
  onFormChange,
  onOpenChange,
  onConfirm,
}: StartTimerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start a timer</DialogTitle>
          <DialogDescription>
            Optionally pin to a project, task, or write a memo for what
            you&apos;re working on.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Project</Label>
            <EntityFormField
              entity="project"
              name="project_id"
              initialId={form.project_id || undefined}
              onChange={(id) => onFormChange({ ...form, project_id: id ?? '' })}
              placeholder="Pick a project (optional)"
            />
          </div>
          <div>
            <Label>Task (optional)</Label>
            <EntityFormField
              entity="task"
              name="task_id"
              initialId={form.task_id || undefined}
              onChange={(id) => onFormChange({ ...form, task_id: id ?? '' })}
              placeholder="Pick a task (optional)"
              allowCreate
            />
          </div>
          <div>
            <Label htmlFor="start-memo">Memo</Label>
            <Textarea
              id="start-memo"
              rows={3}
              value={form.memo}
              onChange={(e) => onFormChange({ ...form, memo: e.target.value })}
              placeholder="What are you working on?"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RejectLogDialogProps {
  open: boolean;
  reason: string;
  onReasonChange: (v: string) => void;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
}

export function RejectLogDialog({
  open,
  reason,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: RejectLogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject log</DialogTitle>
          <DialogDescription>
            Give a reason for the rejection — the employee will see this.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Reason…"
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
