import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailContextBarProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
  className?: string;
}

export function EmailContextBar({
  title,
  subtitle,
  icon: Icon,
  right,
  className,
}: EmailContextBarProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-4 border-b border-[var(--st-border)] py-3 px-1',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon ? (
          <div className="grid place-items-center h-9 w-9 rounded-lg bg-[var(--st-bg)] text-[var(--st-text)]">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-[var(--st-text)] truncate">{title}</h1>
          {subtitle ? (
            <p className="text-xs text-[var(--st-text-secondary)] truncate">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </header>
  );
}
