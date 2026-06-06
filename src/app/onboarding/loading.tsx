import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function OnboardingLoading() {
    return (
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-3">
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                    ))}
                </div>
            </aside>
            <section className="space-y-6">
                <header className="space-y-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </header>
                <div className="rounded-2xl border bg-[var(--st-bg-secondary)] p-6 shadow-sm sm:p-8">
                    <div className="space-y-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                        ))}
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
            </section>
        </div>
    );
}
