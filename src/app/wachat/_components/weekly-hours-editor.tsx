'use client';

import {
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  Plus,
  Trash2 } from 'lucide-react';
import type { WeeklyOperatingHours } from '@/lib/definitions';

/**
 * WeeklyHoursEditor (wachat-local, ZoruUI).
 *
 * Adds/edits weekly operating hours rows. Pure controlled component —
 * mirrors the wabasimplify version's API exactly.
 */

import * as React from 'react';

const daysOfWeek = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

interface WeeklyHoursEditorProps {
  hours: WeeklyOperatingHours[];
  onChange: (newHours: WeeklyOperatingHours[]) => void;
}

export const WeeklyHoursEditor: React.FC<WeeklyHoursEditorProps> = ({
  hours,
  onChange,
}) => {
  const handleAdd = () => {
    onChange([
      ...hours,
      { day_of_week: 'MONDAY', open_time: '0900', close_time: '1700' },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(hours.filter((_, i) => i !== index));
  };

  const handleChange = (
    index: number,
    field: keyof WeeklyOperatingHours,
    value: string,
  ) => {
    const newHours = [...hours];
    const item = { ...newHours[index] };
    if (field === 'open_time' || field === 'close_time') {
      (item as any)[field] = value.replace(':', '');
    } else {
      (item as any)[field] = value;
    }
    newHours[index] = item;
    onChange(newHours);
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-[14px] text-zoru-ink">Weekly Operating Hours</h4>
      <div className="flex flex-col gap-3">
        {hours.map((entry, index) => (
          <div
            key={index}
            className="relative rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-3"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove time slot"
              className="absolute right-1 top-1 text-zoru-danger hover:bg-zoru-danger/10"
              onClick={() => handleRemove(index)}
            >
              <Trash2 />
            </Button>
            <div className="grid items-end gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Day of Week</Label>
                <Select
                  value={entry.day_of_week}
                  onValueChange={(val) =>
                    handleChange(index, 'day_of_week', val)
                  }
                >
                  <ZoruSelectTrigger>
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {daysOfWeek.map((day) => (
                      <ZoruSelectItem key={day} value={day}>
                        {day}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Open Time</Label>
                <Input
                  type="time"
                  value={
                    entry.open_time.slice(0, 2) + ':' + entry.open_time.slice(2)
                  }
                  onChange={(e) =>
                    handleChange(index, 'open_time', e.target.value)
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Close Time</Label>
                <Input
                  type="time"
                  value={
                    entry.close_time.slice(0, 2) +
                    ':' +
                    entry.close_time.slice(2)
                  }
                  onChange={(e) =>
                    handleChange(index, 'close_time', e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
      >
        <Plus />
        Add Time Slot
      </Button>
    </div>
  );
};
