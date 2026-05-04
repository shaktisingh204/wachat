'use client';

/**
 * HolidayScheduleEditor (wachat-local, ZoruUI).
 *
 * Adds/edits holiday-override entries that override weekly hours on
 * specific dates. Mirrors the wabasimplify version's API exactly.
 */

import * as React from 'react';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import type { HolidaySchedule } from '@/lib/definitions';

import {
  ZoruButton,
  ZoruDatePicker,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';

interface HolidayScheduleEditorProps {
  schedule: HolidaySchedule[];
  onChange: (newSchedule: HolidaySchedule[]) => void;
}

export const HolidayScheduleEditor: React.FC<HolidayScheduleEditorProps> = ({
  schedule,
  onChange,
}) => {
  const handleAdd = () => {
    onChange([
      ...schedule,
      {
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '0000',
        end_time: '2359',
      },
    ]);
  };

  const handleRemove = (index: number) => {
    onChange(schedule.filter((_, i) => i !== index));
  };

  const handleChange = (
    index: number,
    field: keyof HolidaySchedule,
    value: string | Date | undefined,
  ) => {
    const newSchedule = [...schedule];
    const item = { ...newSchedule[index] };
    if (field === 'date' && value instanceof Date) {
      item.date = format(value, 'yyyy-MM-dd');
    } else if (typeof value === 'string') {
      (item as any)[field] = value.replace(':', '');
    }
    newSchedule[index] = item;
    onChange(newSchedule);
  };

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-[14px] text-zoru-ink">
        Holiday Schedule (Overrides)
      </h4>
      <div className="flex flex-col gap-3">
        {schedule.map((entry, index) => (
          <div
            key={index}
            className="relative rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-3"
          >
            <ZoruButton
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove holiday"
              className="absolute right-1 top-1 text-zoru-danger hover:bg-zoru-danger/10"
              onClick={() => handleRemove(index)}
            >
              <Trash2 />
            </ZoruButton>
            <div className="grid items-end gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel>Date</ZoruLabel>
                <ZoruDatePicker
                  value={new Date(entry.date)}
                  onChange={(d) => handleChange(index, 'date', d)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel>Start Time</ZoruLabel>
                <ZoruInput
                  type="time"
                  value={
                    entry.start_time.slice(0, 2) +
                    ':' +
                    entry.start_time.slice(2)
                  }
                  onChange={(e) =>
                    handleChange(index, 'start_time', e.target.value)
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel>End Time</ZoruLabel>
                <ZoruInput
                  type="time"
                  value={
                    entry.end_time.slice(0, 2) + ':' + entry.end_time.slice(2)
                  }
                  onChange={(e) =>
                    handleChange(index, 'end_time', e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <ZoruButton
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
      >
        <Plus />
        Add Holiday
      </ZoruButton>
    </div>
  );
};
