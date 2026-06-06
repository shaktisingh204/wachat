import { FileSpreadsheet } from 'lucide-react';
import { PageHeader, PageHeading, PageTitle, PageDescription, Skeleton } from '@/components/sabcrm/20ui/compat';

export default function ImportExportLoading() {
    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
                        <FileSpreadsheet className="h-5 w-5 text-[var(--st-text)]" strokeWidth={1.75} />
                    </div>
                    <PageHeading>
                        <PageTitle>
                            <Skeleton className="h-8 w-48" />
                        </PageTitle>
                        <PageDescription>
                            <Skeleton className="mt-2 h-4 w-64" />
                        </PageDescription>
                    </PageHeading>
                </div>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
            </div>

            <div className="mt-4 flex flex-col gap-6">
                <Skeleton className="h-[500px] w-full rounded-xl" />
            </div>
        </div>
    );
}
