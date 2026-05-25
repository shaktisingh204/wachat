import { Card, ZoruCardContent, Skeleton } from '@/components/zoruui';

export default function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[400px]" />
      </div>
      <Card>
        <ZoruCardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
