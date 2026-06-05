import { Skeleton } from '@/components/sabcrm/20ui';
import WachatPage from '@/app/wachat/_components/wachat-page';

export default function WachatLoading() {
  return (
    <WachatPage>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton width={220} height={28} radius={8} />
          <Skeleton width={360} height={16} radius={6} />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton height={64} radius={12} />
          <Skeleton height={64} radius={12} />
          <Skeleton height={64} radius={12} />
        </div>
      </div>
    </WachatPage>
  );
}
