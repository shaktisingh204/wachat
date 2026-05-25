'use client';

import React, { useState } from 'react';
import { ExpenseClaim } from '@/lib/hrm-advanced-types';
import { Button, Input, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter } from '@/components/zoruui';

interface ClaimFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<ExpenseClaim>;
  onSave: (data: Partial<ExpenseClaim>) => Promise<void>;
}

export function ClaimForm({ open, onOpenChange, initialData, onSave }: ClaimFormProps) {
  const [formData, setFormData] = useState<Partial<ExpenseClaim>>(
    initialData || { amount: 0, status: 'Pending', dateSubmitted: new Date().toISOString().split('T')[0] }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when opened with new initialData
  React.useEffect(() => {
    if (open) {
      setFormData(initialData || { amount: 0, status: 'Pending', dateSubmitted: new Date().toISOString().split('T')[0] });
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <ZoruDialogContent>
        <form onSubmit={handleSubmit}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{initialData?._id ? 'Edit' : 'Add'} Expense Claim</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Employee ID</label>
              <Input
                required
                value={formData.employeeId || ''}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="EMP-001"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                required
                min={0}
                step={0.01}
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Category</label>
              <Input
                required
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Travel, Meals, Office Supplies"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Status</label>
              <select
                className="flex h-10 w-full rounded-md border border-zoru-line bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zoru-brand"
                value={formData.status || 'Pending'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ExpenseClaim['status'] })}
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Date Submitted</label>
              <Input
                type="date"
                required
                value={formData.dateSubmitted || ''}
                onChange={(e) => setFormData({ ...formData, dateSubmitted: e.target.value })}
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>Save</Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
