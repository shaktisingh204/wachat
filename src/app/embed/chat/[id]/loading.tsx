import { Skeleton } from '@/components/sabcrm/20ui';

export default function EmbedLoading() {
  return (
    <main
      className="20ui m-0 p-0 h-screen flex flex-col bg-[var(--st-bg)] text-[var(--st-text)]"
      aria-busy="true"
      aria-label="Loading chat"
    >
      <header className="flex h-[45px] items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3">
        <Skeleton width={120} height={16} radius={4} />
        <Skeleton width={20} height={20} radius={4} />
      </header>

      <div className="border-b border-[var(--st-border)] px-4 py-3">
        <Skeleton width="65%" height={14} radius={4} />
      </div>

      <section className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="self-start" width="75%" height={40} radius={12} />
        <Skeleton className="self-start" width="55%" height={40} radius={12} />
        <Skeleton className="self-end" width="65%" height={40} radius={12} />
        <Skeleton className="self-start" width="85%" height={40} radius={12} />
      </section>

      <div className="flex gap-2 border-t border-[var(--st-border)] p-4">
        <Skeleton className="flex-1" height={40} radius={20} />
        <Skeleton width={40} height={40} circle />
      </div>
    </main>
  );
}
