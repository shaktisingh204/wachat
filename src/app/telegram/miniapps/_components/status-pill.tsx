import { cn } from '@/components/sabcrm/20ui/compat';

export function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]'
          : 'bg-[var(--st-text)]/10 text-[var(--st-text)]',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-[var(--st-text)]' : 'bg-[var(--st-bg-muted)]',
        )}
      />
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}
