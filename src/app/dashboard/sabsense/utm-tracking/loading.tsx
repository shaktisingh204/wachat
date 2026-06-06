export default function Loading() {
  return (
    <div className="flex h-[400px] w-full items-center justify-center rounded-[var(--zoru-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 p-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
        <p className="text-sm text-[var(--st-text-secondary)] animate-pulse">Loading UTM links...</p>
      </div>
    </div>
  );
}
