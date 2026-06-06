import React, { memo } from 'react';
import { Trash, LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button, Checkbox } from '@/components/sabcrm/20ui/compat';

export type EmployeeLite = { _id: string; firstName?: string; lastName?: string };

type TimesheetEntry = {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  status?: 'saving' | 'saved' | 'error';
};

interface TimesheetRowProps {
  entry: TimesheetEntry;
  employees: EmployeeLite[];
  isSelected: boolean;
  virtualItem: any;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, field: keyof TimesheetEntry, value: string) => void;
  onRemove: (id: string) => void;
}

export const TimesheetRow = memo(({
  entry,
  employees,
  isSelected,
  virtualItem,
  onToggleSelect,
  onUpdate,
  onRemove
}: TimesheetRowProps) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start}px)`,
      }}
      className={`flex items-center gap-4 px-4 border-b border-[var(--st-border)]/50 transition-colors ${entry.status === 'saving' ? 'opacity-70 bg-[var(--st-bg-secondary)]' : 'hover:bg-[var(--st-bg)]/50'}`}
    >
      <Checkbox 
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(entry.id)}
        disabled={entry.status === 'saving'}
      />
      
      <div className="w-[25%]">
        <Select 
          value={entry.userId} 
          onValueChange={(val) => onUpdate(entry.id, 'userId', val)}
          disabled={entry.status === 'saving'}
        >
          <SelectTrigger className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e._id} value={e._id}>
                {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[25%]">
        <Input
          type="date"
          value={entry.weekStart}
          onChange={(e) => onUpdate(entry.id, 'weekStart', e.target.value)}
          required
          disabled={entry.status === 'saving'}
          className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
        />
      </div>

      <div className="w-[25%]">
        <Input
          type="date"
          value={entry.weekEnd}
          readOnly
          className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px] opacity-60"
        />
      </div>

      <div className="w-[15%] flex justify-end items-center gap-2">
        {entry.status === 'saving' && <LoaderCircle className="h-4 w-4 animate-spin text-[var(--st-text-secondary)]" />}
        {entry.status === 'saved' && <CheckCircle2 className="h-4 w-4 text-[var(--st-text)]" />}
        {entry.status === 'error' && <AlertCircle className="h-4 w-4 text-[var(--st-text)]" />}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-[var(--st-danger)] hover:bg-[var(--st-danger-soft)] hover:text-[var(--st-danger)]"
          onClick={() => onRemove(entry.id)}
          disabled={entry.status === 'saving'}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

TimesheetRow.displayName = 'TimesheetRow';
