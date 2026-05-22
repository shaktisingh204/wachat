import { Skeleton } from '@/components/zoruui';
/**
 * /dashboard/* loading fallback. Shown instantly during route
 * transitions while the layout's session + project + RBAC checks
 * resolve, so the dock click feels immediate. The skeleton mirrors
 * the dashboard page header + stat strip + module grid layout.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />

      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-56" />
        <div className="flex gap-2">
          <ZoruSkeleton className="h-9 w-24 rounded-full" />
          <ZoruSkeleton className="h-9 w-24 rounded-full" />
          <ZoruSkeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
        <ZoruSkeleton className="h-[150px]" />
        <ZoruSkeleton className="h-[150px]" />
        <div className="flex flex-col gap-2">
          <ZoruSkeleton className="h-11" />
          <ZoruSkeleton className="h-11" />
          <ZoruSkeleton className="h-11" />
        </div>
      </div>

      <div className="mt-10">
        <ZoruSkeleton className="h-5 w-32" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    </div>
  );
}
