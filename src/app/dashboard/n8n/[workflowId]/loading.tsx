import { LuLoader } from 'react-icons/lu';

export default function N8NWorkflowLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--gray-2)]">
      <div className="flex flex-col items-center gap-3">
        <LuLoader className="h-6 w-6 animate-spin text-zoru-ink" />
        <p className="text-sm text-[var(--gray-11)] font-medium">Loading workflow editor...</p>
      </div>
    </div>
  );
}
