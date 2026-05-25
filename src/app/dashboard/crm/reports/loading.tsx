import { BarChart3 } from 'lucide-react';
import { PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription, Skeleton } from '@/components/zoruui';

export default function ReportsLoading() {
    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
                        <BarChart3 className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
                    </div>
                    <ZoruPageHeading>
                        <ZoruPageTitle>
                            <Skeleton className="h-8 w-48" />
                        </ZoruPageTitle>
                        <ZoruPageDescription>
                            <Skeleton className="mt-2 h-4 w-64" />
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </div>
            </PageHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
            </div>

            <div className="mt-4 flex flex-col gap-6">
                <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
        </div>
    );
}
