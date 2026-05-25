import { cn } from '@/components/zoruui';

export function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        active
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
          : 'bg-zinc-500/10 text-zinc-500',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          active ? 'bg-emerald-500' : 'bg-zinc-400',
        )}
      />
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}
