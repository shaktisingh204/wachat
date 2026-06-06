'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/sabcrm/20ui/compat';
import { OffboardingTask } from '@/lib/hrm-advanced-types';

interface OffboardingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<OffboardingTask>;
  onSave: (data: Partial<OffboardingTask>) => Promise<void>;
}

export function OffboardingForm({ open, onOpenChange, initialData, onSave }: OffboardingFormProps) {
  const [formData, setFormData] = useState<Partial<OffboardingTask>>({
    isCompleted: false,
    ...initialData
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData({ isCompleted: false, ...initialData });
    }
  }, [open, initialData]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData?._id ? 'Edit' : 'Add'} Offboarding Task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Task Name</label>
            <Input
              type="text"
              value={formData.taskName || ''}
              onChange={(e) => setFormData({ ...formData, taskName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Employee ID</label>
            <Input
              type="text"
              value={formData.employeeId || ''}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Due Date</label>
            <Input
              type="date"
              value={formData.dueDate || ''}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isCompleted"
              checked={Boolean(formData.isCompleted)}
              onChange={(e) => setFormData({ ...formData, isCompleted: e.target.checked })}
            />
            <label htmlFor="isCompleted" className="text-sm font-medium">Completed</label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
