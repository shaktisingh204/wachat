'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { TrainingCourse, TrainingCourseSchema } from '@/lib/hrm-advanced-types';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Input } from '@/components/sabcrm/20ui/compat';
import { Label } from '@/components/sabcrm/20ui/compat';
import { Textarea } from '@/components/sabcrm/20ui/compat';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/sabcrm/20ui/compat';
import { saveTrainingCourse } from '@/app/actions/hrm-advanced/lms-training';
import { toast } from 'sonner';

interface TrainingCourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: TrainingCourse | null;
  onSaveOptimistic: (course: TrainingCourse, isNew: boolean) => void;
}

export function TrainingCourseFormDialog({ open, onOpenChange, course, onSaveOptimistic }: TrainingCourseFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<Partial<TrainingCourse>>({
    title: '',
    description: '',
    enrolledCount: 0,
    durationHours: 1,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (course) {
        setFormData(course);
      } else {
        setFormData({
          title: '',
          description: '',
          enrolledCount: 0,
          durationHours: 1,
        });
      }
      setErrors({});
    }
  }, [open, course]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert to appropriate types
    const payload = {
      ...formData,
      enrolledCount: Number(formData.enrolledCount) || 0,
      durationHours: Number(formData.durationHours) || 0,
    };

    const parsed = TrainingCourseSchema.safeParse(payload);
    
    if (!parsed.success) {
      const newErrors: Record<string, string> = {};
      parsed.error.errors.forEach(err => {
        if (err.path[0]) {
          newErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    const isNew = !formData._id;
    
    // Optimistic UI updates
    // For optimistic creation we need a fake ID to avoid React key issues temporarily,
    // but the real save will fetch the true data. If the user creates again immediately it might be an issue
    // if we don't handle real IDs. The server action returns the saved data.
    
    startTransition(async () => {
      try {
        const result = await saveTrainingCourse(parsed.data);
        if (result.error) {
          throw new Error(result.error);
        }
        
        // Pass the fully updated entity
        if (result.data) {
          onSaveOptimistic(result.data as TrainingCourse, isNew);
        } else {
          // Fallback if data is missing
          onSaveOptimistic({ ...parsed.data, _id: formData._id || Date.now().toString() } as TrainingCourse, isNew);
        }
        
        toast.success(`Course ${isNew ? 'created' : 'updated'} successfully`);
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || 'Failed to save course');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit Course' : 'Add Course'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input 
              id="title"
              name="title" 
              value={formData.title || ''} 
              onChange={handleChange} 
              disabled={isPending}
            />
            {errors.title && <p className="text-sm text-[var(--st-text)]">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description"
              name="description" 
              value={formData.description || ''} 
              onChange={handleChange} 
              rows={3}
              disabled={isPending}
            />
            {errors.description && <p className="text-sm text-[var(--st-text)]">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="enrolledCount">Enrolled Count</Label>
              <Input 
                id="enrolledCount"
                name="enrolledCount" 
                type="number" 
                min="0"
                value={formData.enrolledCount?.toString() || '0'} 
                onChange={handleChange} 
                disabled={isPending}
              />
              {errors.enrolledCount && <p className="text-sm text-[var(--st-text)]">{errors.enrolledCount}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationHours">Duration (hrs) *</Label>
              <Input 
                id="durationHours"
                name="durationHours" 
                type="number"
                min="0"
                step="0.5"
                value={formData.durationHours?.toString() || '1'} 
                onChange={handleChange} 
                disabled={isPending}
              />
              {errors.durationHours && <p className="text-sm text-[var(--st-text)]">{errors.durationHours}</p>}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
