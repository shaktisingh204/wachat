import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox, Button } from '@/components/sabcrm/20ui';
import { Trash } from 'lucide-react';
import type { EmployeeLite } from '../new-timesheet-client';

interface TimesheetRowProps {
  entry: {
    id: string;
    userId: string;
    weekStart: string;
    weekEnd: string;
  };
  employees: EmployeeLite[];
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onUpdate: (id: string, field: 'userId' | 'weekStart' | 'weekEnd', value: string) => void;
  onRemove: (id: string) => void;
  style?: React.CSSProperties;
}

export function TimesheetRow({
  entry,
  employees,
  isSelected,
  onToggleSelect,
  onUpdate,
  onRemove,
  style,
}: TimesheetRowProps) {
  return (
    <div
      style={style}
      className="flex items-center gap-4 px-4 border-b border-[var(--st-border)]/50 hover:bg-[var(--st-bg)]/50 transition-colors"
    >
      <Checkbox 
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(entry.id)}
      />
      
      <div className="w-[30%]">
        <Select 
          value={entry.userId} 
          onValueChange={(val) => onUpdate(entry.id, 'userId', val)}
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

      <div className="w-[30%]">
        <Input
          type="date"
          value={entry.weekStart}
          onChange={(e) => onUpdate(entry.id, 'weekStart', e.target.value)}
          required
          className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
        />
      </div>

      <div className="w-[30%]">
        <Input
          type="date"
          value={entry.weekEnd}
          readOnly
          className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px] opacity-60"
        />
      </div>

      <div className="w-[10%] flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-[var(--st-danger)] hover:bg-[var(--st-danger-soft)] hover:text-[var(--st-danger)]"
          onClick={() => onRemove(entry.id)}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
