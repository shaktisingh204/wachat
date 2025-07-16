
'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { HolidaySchedule } from '@/lib/definitions';
import { DatePicker } from '../ui/date-picker';
import { format } from 'date-fns';

interface HolidayScheduleEditorProps {
    schedule: HolidaySchedule[];
    onChange: (newSchedule: HolidaySchedule[]) => void;
}

export const HolidayScheduleEditor: React.FC<HolidayScheduleEditorProps> = ({ schedule, onChange }) => {
    
    const handleAdd = () => {
        onChange([...schedule, { date: format(new Date(), 'yyyy-MM-dd'), start_time: '0000', end_time: '2359' }]);
    };

    const handleRemove = (index: number) => {
        onChange(schedule.filter((_, i) => i !== index));
    };

    const handleChange = (index: number, field: keyof HolidaySchedule, value: string | Date | undefined) => {
        const newSchedule = [...schedule];
        const item = {...newSchedule[index]};
        if (field === 'date' && value instanceof Date) {
            item.date = format(value, 'yyyy-MM-dd');
        } else if (typeof value === 'string') {
            (item as any)[field] = value.replace(':', '');
        }
        newSchedule[index] = item;
        onChange(newSchedule);
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-base">Holiday Schedule (Overrides)</h4>
            <div className="space-y-3">
                {schedule.map((entry, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-3 relative bg-muted/50">
                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                         <div className="grid md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <DatePicker date={new Date(entry.date)} setDate={(d) => handleChange(index, 'date', d)}/>
                            </div>
                            <div className="space-y-2">
                                <Label>Start Time</Label>
                                <Input type="time" value={entry.start_time.slice(0,2) + ':' + entry.start_time.slice(2)} onChange={e => handleChange(index, 'start_time', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Time</Label>
                                <Input type="time" value={entry.end_time.slice(0,2) + ':' + entry.end_time.slice(2)} onChange={e => handleChange(index, 'end_time', e.target.value)} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" onClick={handleAdd}><Plus className="mr-2 h-4 w-4"/>Add Holiday</Button>
        </div>
    );
};
