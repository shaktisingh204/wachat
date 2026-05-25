import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruSkeleton,
} from '@/components/zoruui';

export default function NewProductionOrderLoading() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-64" />
        <ZoruSkeleton className="h-9 w-24" />
      </div>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruSkeleton className="h-6 w-32 mb-2" />
          <ZoruSkeleton className="h-4 w-64" />
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-6">
          {/* General Information Section */}
          <div className="space-y-4">
            <ZoruSkeleton className="h-5 w-40" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <ZoruSkeleton className="h-4 w-20" />
                <ZoruSkeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <ZoruSkeleton className="h-4 w-24" />
                <ZoruSkeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="space-y-2">
                <ZoruSkeleton className="h-4 w-16" />
                <ZoruSkeleton className="h-24 w-full" />
            </div>
          </div>

          {/* Dates Section */}
          <div className="space-y-4">
            <ZoruSkeleton className="h-5 w-32" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <ZoruSkeleton className="h-4 w-28" />
                <ZoruSkeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <ZoruSkeleton className="h-4 w-28" />
                <ZoruSkeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-4 mt-6">
            <ZoruSkeleton className="h-10 w-24" />
            <ZoruSkeleton className="h-10 w-32" />
          </div>
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}
