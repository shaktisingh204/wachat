import { Skeleton } from '@/components/zoruui';

export default function Loading() {
  return (
    <div className="flex flex-col h-full bg-zoru-background">
      {/* Shell Header Skeleton */}
      <div className="sticky top-0 z-10 border-b border-zoru-line bg-zoru-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-md" /> {/* Back button */}
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" /> {/* Eyebrow */}
              <Skeleton className="h-6 w-32" /> {/* Title */}
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="flex-1 overflow-auto p-6 w-full">
        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-6 shadow-sm">
          <div className="flex flex-col gap-6">
            {/* Form Fields */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full max-w-xs" />
              </div>
            ))}
            
            {/* Notes Textarea */}
            <div className="flex flex-col gap-1.5 mt-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-24 w-full max-w-lg" />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-4">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
