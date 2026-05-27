import { cn } from '@/components/zoruui';

export function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'bg-zoru-ink/10 text-zoru-ink dark:text-zoru-ink-muted'
          : 'bg-zoru-ink/10 text-zoru-ink',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-zoru-ink' : 'bg-zoru-surface-2',
        )}
      />
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}
