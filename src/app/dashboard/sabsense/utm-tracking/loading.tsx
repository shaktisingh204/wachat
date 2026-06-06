import { Spinner } from '@/components/sabcrm/20ui';

export default function Loading() {
  return (
    <div className="ui20 flex h-[400px] w-full items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 p-8">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" label="Loading UTM links" />
        <p className="text-sm text-[var(--st-text-secondary)]">Loading UTM links...</p>
      </div>
    </div>
  );
}
