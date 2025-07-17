
'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WeeklyOperatingHours } from '@/lib/definitions';

const daysOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

interface WeeklyHoursEditorProps {
    hours: WeeklyOperatingHours[];
    onChange: (newHours: WeeklyOperatingHours[]) => void;
}

export const WeeklyHoursEditor: React.FC<WeeklyHoursEditorProps> = ({ hours, onChange }) => {
    
    const handleAdd = () => {
        onChange([...hours, { day_of_week: 'MONDAY', open_time: '0900', close_time: '1700' }]);
    };

    const handleRemove = (index: number) => {
        onChange(hours.filter((_, i) => i !== index));
    };

    const handleChange = (index: number, field: keyof WeeklyOperatingHours, value: string) => {
        const newHours = [...hours];
        const item = {...newHours[index]};
        // Format time to HHMM
        if (field === 'open_time' || field === 'close_time') {
            (item as any)[field] = value.replace(':', '');
        } else {
            (item as any)[field] = value;
        }
        newHours[index] = item;
        onChange(newHours);
    };

    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-base">Weekly Operating Hours</h4>
            <div className="space-y-3">
                {hours.map((entry, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-3 relative bg-muted/50">
                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        <div className="grid md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Day of Week</Label>
                                <Select value={entry.day_of_week} onValueChange={(val) => handleChange(index, 'day_of_week', val)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        {daysOfWeek.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Open Time</Label>
                                <Input type="time" value={entry.open_time.slice(0,2) + ':' + entry.open_time.slice(2)} onChange={e => handleChange(index, 'open_time', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Close Time</Label>
                                <Input type="time" value={entry.close_time.slice(0,2) + ':' + entry.close_time.slice(2)} onChange={e => handleChange(index, 'close_time', e.target.value)} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" onClick={handleAdd}><Plus className="mr-2 h-4 w-4"/>Add Time Slot</Button>
        </div>
    );
};
