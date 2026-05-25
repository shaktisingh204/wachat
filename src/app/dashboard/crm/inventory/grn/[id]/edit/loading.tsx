import { Skeleton } from '@/components/zoruui';

export default function EditGrnLoading() {
    return (
        <div className="flex w-full flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            <div className="rounded-lg border border-zoru-line p-6">
                <div className="grid gap-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ))}
                    </div>
                    
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-32 w-full" />
                    </div>

                    <div className="flex justify-end gap-3 pt-6">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
            </div>
        </div>
    );
}
