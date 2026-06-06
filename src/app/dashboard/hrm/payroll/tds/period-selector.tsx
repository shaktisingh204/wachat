import { Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/sabcrm/20ui/compat';

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
          <ZoruSelectTrigger className="w-36 h-9 rounded-full border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
              <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
              {months.map(m => <ZoruSelectItem key={m.value} value={String(m.value)}>{m.label}</ZoruSelectItem>)}
          </ZoruSelectContent>
      </Select>
      <Select value={String(year)} onValueChange={val => onYearChange(Number(val))}>
          <ZoruSelectTrigger className="w-28 h-9 rounded-full border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
              <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
              {years.map(y => <ZoruSelectItem key={y} value={String(y)}>{y}</ZoruSelectItem>)}
          </ZoruSelectContent>
      </Select>
    </>
  );
}
