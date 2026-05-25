import { ZoruSkeleton } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function ProductsLoading() {
  return (
    <EntityListShell
      title="Products"
      subtitle="Manage your inventory products, services, margins, and stock levels."
    >
      <div className="flex flex-col gap-6">
        {/* Filter controls skeleton */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <ZoruSkeleton className="h-10 w-full rounded-lg animate-pulse" />
          <ZoruSkeleton className="h-10 w-full rounded-lg animate-pulse" />
          <ZoruSkeleton className="h-10 w-full rounded-lg animate-pulse" />
          <ZoruSkeleton className="h-10 w-full rounded-lg animate-pulse" />
          <ZoruSkeleton className="h-10 w-full rounded-lg animate-pulse" />
        </div>

        {/* KPI Strip skeletons */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ZoruSkeleton className="h-24 w-full rounded-xl animate-pulse" />
          <ZoruSkeleton className="h-24 w-full rounded-xl animate-pulse" />
          <ZoruSkeleton className="h-24 w-full rounded-xl animate-pulse" />
          <ZoruSkeleton className="h-24 w-full rounded-xl animate-pulse" />
        </div>

        {/* Products Grid skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <ZoruSkeleton key={i} className="h-80 w-full rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </EntityListShell>
  );
}
