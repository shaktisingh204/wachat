'use client';

import * as React from 'react';
import { useActionState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Button,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { LoaderCircle } from 'lucide-react';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveShift } from '@/app/actions/crm-shifts.actions';
import type { CrmShiftDoc, CrmShiftStatus } from '@/lib/rust-client/crm-shifts';

const WEEKDAYS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
      Save changes
    </Button>
  );
}

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
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(saveShift, {});

  const handleFormAction = (formData: FormData) => {
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
    React.startTransition(() => {
      formAction(formData);
    });
  };

  const [color, setColor] = React.useState(initial.color ?? '#EAB308');
  const [isNight, setIsNight] = React.useState(!!initial.isNightShift);
  const [isDefault, setIsDefault] = React.useState(!!initial.isDefault);
  const [days, setDays] = React.useState<string[]>(
    initial.workingDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  );
  const [status, setStatus] = React.useState<CrmShiftStatus>(
    (initial.status as CrmShiftStatus) ?? 'active'
  );

  React.useEffect(() => {
    if (!open) return;
    setColor(initial.color ?? '#EAB308');
    setIsNight(!!initial.isNightShift);
    setIsDefault(!!initial.isDefault);
    setDays(
      initial.workingDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    );
    setStatus((initial.status as CrmShiftStatus) ?? 'active');
  }, [open, initial]);

  React.useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success', description: state.message });
      onOpenChange(false);
    }
    if (state?.error) {
      toast({
        title: 'Update failed',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, onOpenChange]);

  const toggleDay = (value: string, on: boolean) => {
    setDays((prev) =>
      on
        ? Array.from(new Set([...prev, value]))
        : prev.filter((d) => d !== value)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-[560px]">
        <form action={handleFormAction} className="flex flex-col gap-4">
          <input type="hidden" name="shiftId" value={initial._id} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="isNightShift" value={isNight ? 'true' : 'false'} />
          <input type="hidden" name="isDefault" value={isDefault ? 'true' : 'false'} />
          <input type="hidden" name="status" value={status} />
          {days.map((d) => (
            <input key={d} type="hidden" name="workingDays" value={d} />
          ))}

          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit shift details</ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Morning Shift"
                defaultValue={initial.name ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                placeholder="MORN"
                defaultValue={initial.code ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color-trigger">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="color-trigger"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-zoru-line bg-transparent p-1"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#EAB308"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Start time *</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                required
                defaultValue={initial.startTime ?? '09:00'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">End time *</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                required
                defaultValue={initial.endTime ?? '18:00'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="breakMinutes">Break (minutes)</Label>
              <Input
                id="breakMinutes"
                name="breakMinutes"
                type="number"
                min="0"
                step="1"
                defaultValue={initial.breakMinutes ?? 60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="graceMinutes">Grace (minutes)</Label>
              <Input
                id="graceMinutes"
                name="graceMinutes"
                type="number"
                min="0"
                step="1"
                defaultValue={initial.graceMinutes ?? 15}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Working days</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <label
                  key={d.value}
                  className="flex items-center gap-2 rounded-md border border-zoru-line bg-zoru-bg px-2.5 py-1.5 text-[12.5px] text-zoru-ink"
                >
                  <Checkbox
                    checked={days.includes(d.value)}
                    onCheckedChange={(v) => toggleDay(d.value, Boolean(v))}
                  />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="departmentIds">Department IDs (comma-separated)</Label>
            <Input
              id="departmentIds"
              name="departmentIds"
              placeholder="Optional — leave blank for all departments"
              defaultValue={(initial.departmentIds ?? []).join(', ')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={initial.description ?? ''}
              placeholder="Optional notes about this shift."
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
              <Checkbox
                checked={isNight}
                onCheckedChange={(v) => setIsNight(Boolean(v))}
              />
              Night shift (crosses midnight)
            </label>
            <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
              <Checkbox
                checked={isDefault}
                onCheckedChange={(v) => setIsDefault(Boolean(v))}
              />
              Default shift
            </label>
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-[12.5px]">Status</Label>
              <EnumFormField
                enumName="activeArchived"
                name="__status_picker"
                initialId={status}
                onChange={(v) => setStatus((v ?? 'active') as CrmShiftStatus)}
              />
            </div>
          </div>

          <ZoruDialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
