'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/sabcrm/20ui/compat';
import type { CrmShiftDoc, CrmShiftStatus } from '@/lib/rust-client/crm-shifts';
import { ShiftForm } from '../../_components/shift-form';

export function ShiftEditForm({
  open,
  onOpenChange,
  initial,
  onOptimisticUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CrmShiftDoc;
  onOptimisticUpdate?: (update: Partial<CrmShiftDoc>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Edit shift details</DialogTitle>
        </DialogHeader>
        <ShiftForm
          initial={initial}
          onSaved={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
          onOptimisticSubmit={(formData: FormData) => {
            if (onOptimisticUpdate) {
              onOptimisticUpdate({
                name: formData.get('name') as string,
                code: formData.get('code') as string,
                startTime: formData.get('startTime') as string,
                endTime: formData.get('endTime') as string,
                breakMinutes: Number(formData.get('breakMinutes')) || 0,
                graceMinutes: Number(formData.get('graceMinutes')) || 0,
                color: formData.get('color') as string,
                isNightShift: formData.get('isNightShift') === 'true',
                isDefault: formData.get('isDefault') === 'true',
                workingDays: formData.getAll('workingDays') as string[],
                status: (formData.get('status') as CrmShiftStatus) || 'active',
              });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
