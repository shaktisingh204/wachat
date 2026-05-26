'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { OnboardingTask, OnboardingTaskSchema } from '@/lib/hrm-advanced-types';
import { Button } from '@/components/zoruui';
import { Input } from '@/components/zoruui';
import { Checkbox } from '@/components/zoruui';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface OnboardingFormProps {
  initialData?: Partial<OnboardingTask>;
  onSubmit: (data: Partial<OnboardingTask>) => Promise<void>;
  onCancel: () => void;
}

export function OnboardingForm({ initialData, onSubmit, onCancel }: OnboardingFormProps) {
  const form = useForm<OnboardingTask>({
    resolver: zodResolver(OnboardingTaskSchema),
    defaultValues: {
      _id: initialData?._id,
      taskName: initialData?.taskName || '',
      employeeId: initialData?.employeeId || '',
      dueDate: initialData?.dueDate ? initialData.dueDate.substring(0, 10) : '',
      isCompleted: initialData?.isCompleted || false,
    },
  });

  const handleSubmit = async (data: OnboardingTask) => {
    try {
      await onSubmit(data);
    } catch (e) {
      // Error is handled by parent, but we could add local form errors here
      console.error(e);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="taskName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Setting up workstation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="employeeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employee ID</FormLabel>
              <FormControl>
                <Input placeholder="e.g. EMP-001" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Due Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isCompleted"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Completed</FormLabel>
              </div>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save Task'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
