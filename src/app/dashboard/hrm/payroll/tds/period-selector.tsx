import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';

export function TdsPeriodSelector({ 
  month, 
  year, 
  onMonthChange, 
  onYearChange,
  months,
  years
}: { 
  month: number; 
  year: number; 
  onMonthChange: (val: number) => void; 
  onYearChange: (val: number) => void;
  months: { value: number; label: string }[];
  years: number[];
}) {
  return (
    <>
      <Select value={String(month)} onValueChange={val => onMonthChange(Number(val))}>
          <SelectTrigger className="w-36 h-9 rounded-full border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
              <SelectValue />
          </SelectTrigger>
          <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
          </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={val => onYearChange(Number(val))}>
          <SelectTrigger className="w-28 h-9 rounded-full border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
              <SelectValue />
          </SelectTrigger>
          <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
      </Select>
    </>
  );
}
