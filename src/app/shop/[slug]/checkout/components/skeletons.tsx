import { ZoruSkeleton } from '@/components/zoruui';

export function CheckoutPageSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <ZoruSkeleton className="h-8 w-1/3 mb-4" />
        <div className="space-y-4">
          <ZoruSkeleton className="h-10 w-full" />
          <ZoruSkeleton className="h-10 w-full" />
          <ZoruSkeleton className="h-10 w-full" />
          <ZoruSkeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
          <ZoruSkeleton className="h-12 w-full mt-6" />
        </div>
      </div>
      <div>
        <ZoruSkeleton className="h-[400px] w-full" />
      </div>
    </div>
  );
}
