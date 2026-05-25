import { Skeleton } from '@/components/zoruui';

export default function GrnDetailLoading() {
    return (
        <div className="flex w-full flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <div className="rounded-lg border border-zoru-line p-6">
                        <Skeleton className="mb-4 h-4 w-24" />
                        <div className="grid gap-4 md:grid-cols-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="space-y-1">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-lg border border-zoru-line p-6">
                        <Skeleton className="mb-4 h-4 w-24" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-zoru-line p-6">
                        <Skeleton className="mb-4 h-4 w-32" />
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-4 w-24" />
                            </div>
                        </div>
                    </div>
                    <div className="rounded-lg border border-zoru-line p-6">
                        <Skeleton className="mb-4 h-4 w-32" />
                        <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-8 w-8 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
