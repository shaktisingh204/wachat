'use client';

import {
  Button,
  Card,
  IconButton,
  Field,
  Input,
  SelectField as Select,
} from '@/components/sabcrm/20ui';
import {
  Plus,
  Trash2 } from 'lucide-react';
import type { WeeklyOperatingHours } from '@/lib/definitions';

/**
 * WeeklyHoursEditor (wachat-local, 20ui).
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

const dayOptions = daysOfWeek.map((day) => ({ value: day, label: day }));

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
      <h4 className="text-[14px] [color:var(--st-text)]">
        Weekly Operating Hours
      </h4>
      <div className="flex flex-col gap-3">
        {hours.map((entry, index) => (
          <Card key={index} variant="outlined" padding="sm" className="relative">
            <div className="absolute right-1 top-1">
              <IconButton
                label="Remove time slot"
                icon={Trash2}
                variant="danger"
                size="sm"
                onClick={() => handleRemove(index)}
              />
            </div>
            <div className="grid items-end gap-3 md:grid-cols-3">
              <Field label="Day of Week">
                <Select
                  aria-label="Day of Week"
                  value={entry.day_of_week}
                  options={dayOptions}
                  onChange={(val) =>
                    handleChange(index, 'day_of_week', val ?? '')
                  }
                />
              </Field>
              <Field label="Open Time">
                <Input
                  type="time"
                  value={
                    entry.open_time.slice(0, 2) + ':' + entry.open_time.slice(2)
                  }
                  onChange={(e) =>
                    handleChange(index, 'open_time', e.target.value)
                  }
                />
              </Field>
              <Field label="Close Time">
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
        Add Time Slot
      </Button>
    </div>
  );
};
