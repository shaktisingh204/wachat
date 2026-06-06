import { Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';

export default function SeoToolsLoading() {
  return (
    <div className="flex flex-col gap-6 w-full animate-pulse">
      {/* Title skeleton */}
      <div>
        <div className="h-8 bg-zoru-surface-2 rounded w-48 mb-2"></div>
        <div className="h-4 bg-zoru-surface-2 rounded w-3/4 max-w-md"></div>
      </div>

      {/* Main content skeleton */}
      <Card className="border-zoru-line">
        <ZoruCardContent className="p-6 space-y-4">
          <div className="flex gap-4">
            <div className="h-10 bg-zoru-surface-2 rounded flex-1"></div>
            <div className="h-10 bg-zoru-surface-2 rounded w-24"></div>
          </div>
          <div className="space-y-2 mt-8">
            <div className="h-4 bg-zoru-surface-2 rounded w-full"></div>
            <div className="h-4 bg-zoru-surface-2 rounded w-5/6"></div>
            <div className="h-4 bg-zoru-surface-2 rounded w-4/6"></div>
          </div>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
