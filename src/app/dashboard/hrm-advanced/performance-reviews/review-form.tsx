'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PerformanceReview, PerformanceReviewSchema } from '@/lib/hrm-advanced-types';
import { Button } from '@/components/ui/button';

interface ReviewFormProps {
  initialData?: Partial<PerformanceReview>;
  onSubmit: (data: PerformanceReview) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ReviewForm({ initialData, onSubmit, onCancel, isSubmitting }: ReviewFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<PerformanceReview>({
    resolver: zodResolver(PerformanceReviewSchema),
    defaultValues: {
      employeeId: initialData?.employeeId || '',
      reviewerId: initialData?.reviewerId || '',
      score: initialData?.score || 5,
      comments: initialData?.comments || '',
      reviewDate: initialData?.reviewDate || new Date().toISOString().split('T')[0],
      ...(initialData?._id ? { _id: initialData._id } : {})
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Employee ID</label>
          <input
            {...register('employeeId')}
            className="w-full border rounded p-2"
            placeholder="E.g., EMP-001"
          />
          {errors.employeeId && <p className="text-red-500 text-xs mt-1">{errors.employeeId.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Reviewer ID</label>
          <input
            {...register('reviewerId')}
            className="w-full border rounded p-2"
            placeholder="E.g., REV-001"
          />
          {errors.reviewerId && <p className="text-red-500 text-xs mt-1">{errors.reviewerId.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Score (0-5)</label>
          <input
            type="number"
            {...register('score')}
            className="w-full border rounded p-2"
            min={0} max={5} step={0.1}
          />
          {errors.score && <p className="text-red-500 text-xs mt-1">{errors.score.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Review Date</label>
          <input
            type="date"
            {...register('reviewDate')}
            className="w-full border rounded p-2"
          />
          {errors.reviewDate && <p className="text-red-500 text-xs mt-1">{errors.reviewDate.message}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Comments</label>
        <textarea
          {...register('comments')}
          className="w-full border rounded p-2 min-h-[100px]"
          placeholder="Detailed review comments..."
        />
        {errors.comments && <p className="text-red-500 text-xs mt-1">{errors.comments.message}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Review'}
        </Button>
      </div>
    </form>
  );
}
