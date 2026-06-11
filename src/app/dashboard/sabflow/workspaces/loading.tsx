import { Skeleton } from '@/components/sabcrm/20ui';
import { SabflowPage } from '../_components/sabflow-page';

export default function SabFlowWorkspacesLoading() {
  return (
    <SabflowPage>
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </SabflowPage>
  );
}
