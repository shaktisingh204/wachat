import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/sabcrm/20ui/compat';

export default function FilesLoading() {
  return (
    <EntityListShell
      title="Files"
      subtitle="Centralized file storage — attach documents to contacts, deals, projects and more."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="p-6 h-fit sticky top-6">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-[90%]" />
            <Skeleton className="h-8 w-[80%]" />
            <Skeleton className="h-8 w-[85%]" />
          </div>
        </Card>

        <Card className="p-6 overflow-hidden flex flex-col">
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Skeleton className="h-10 w-full sm:w-64" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zoru-line flex-1">
            <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 border-zoru-line">
                        <div className="flex gap-4 items-center">
                            <Skeleton className="h-10 w-10" />
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-40" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-16" />
                        <div className="flex gap-2">
                             <Skeleton className="h-8 w-16" />
                             <Skeleton className="h-8 w-16" />
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </Card>
      </div>
    </EntityListShell>
  );
}
