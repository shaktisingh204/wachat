export default function ShiftDetailLoading() {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-zoru-line border-t-zoru-ink-muted"></div>
      <p className="text-sm text-zoru-ink-muted">Loading shift details...</p>
    </div>
  );
}
