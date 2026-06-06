import { LoaderCircle } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center p-12">
      <LoaderCircle className="w-8 h-8 animate-spin text-[var(--st-text-tertiary)]" />
    </div>
  );
}
