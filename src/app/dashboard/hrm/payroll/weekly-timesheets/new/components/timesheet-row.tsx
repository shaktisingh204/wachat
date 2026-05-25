import {
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruCheckbox,
  Button,
} from '@/components/zoruui';
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
      className="flex items-center gap-4 px-4 border-b border-zoru-line/50 hover:bg-zoru-bg/50 transition-colors"
    >
      <ZoruCheckbox 
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(entry.id)}
      />
      
      <div className="w-[30%]">
        <Select 
          value={entry.userId} 
          onValueChange={(val) => onUpdate(entry.id, 'userId', val)}
        >
          <ZoruSelectTrigger className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
            <ZoruSelectValue placeholder="Select employee" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {employees.map((e) => (
              <ZoruSelectItem key={e._id} value={e._id}>
                {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
      </div>

      <div className="w-[30%]">
        <Input
          type="date"
          value={entry.weekStart}
          onChange={(e) => onUpdate(entry.id, 'weekStart', e.target.value)}
          required
          className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
        />
      </div>

      <div className="w-[30%]">
        <Input
          type="date"
          value={entry.weekEnd}
          readOnly
          className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px] opacity-60"
        />
      </div>

      <div className="w-[10%] flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-zoru-danger-ink hover:bg-zoru-danger-bg hover:text-zoru-danger-ink"
          onClick={() => onRemove(entry.id)}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
