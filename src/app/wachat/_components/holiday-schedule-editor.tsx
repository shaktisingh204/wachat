'use client';

import { Button, Card, DatePicker, Field, IconButton, Input } from '@/components/sabcrm/20ui';
import {
  format } from 'date-fns';
import { Plus,
  Trash2 } from 'lucide-react';
import type { HolidaySchedule } from '@/lib/definitions';

/**
 * HolidayScheduleEditor (wachat-local, 20ui).
 *
 * Adds/edits holiday-override entries that override weekly hours on
 * specific dates. Mirrors the wabasimplify version's API exactly.
 */

import * as React from 'react';

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
      <h4 className="text-[14px] text-[var(--st-text)]">
        Holiday Schedule (Overrides)
      </h4>
      <div className="flex flex-col gap-3">
        {schedule.map((entry, index) => (
          <Card
            key={index}
            variant="outlined"
            padding="sm"
            className="relative"
          >
            <div className="absolute right-1 top-1">
              <IconButton
                label="Remove holiday"
                icon={Trash2}
                variant="danger"
                size="sm"
                onClick={() => handleRemove(index)}
              />
            </div>
            <div className="grid items-end gap-3 md:grid-cols-3">
              <Field label="Date">
                <DatePicker
                  value={new Date(entry.date)}
                  onChange={(d) => handleChange(index, 'date', d)}
                />
              </Field>
              <Field label="Start Time">
                <Input
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
              </Field>
              <Field label="End Time">
                <Input
                  type="time"
                  value={
                    entry.end_time.slice(0, 2) + ':' + entry.end_time.slice(2)
                  }
                  onChange={(e) =>
                    handleChange(index, 'end_time', e.target.value)
                  }
                />
              </Field>
            </div>
          </Card>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        iconLeft={Plus}
        onClick={handleAdd}
      >
        Add Holiday
      </Button>
    </div>
  );
};
