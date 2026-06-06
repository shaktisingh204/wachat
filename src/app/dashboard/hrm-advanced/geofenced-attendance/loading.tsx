import { LoaderCircle } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-[400px] items-center justify-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
    </div>
  );
}