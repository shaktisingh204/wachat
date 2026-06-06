import { Skeleton } from "@/components/zoruui";
import { EntityListShell } from "@/components/crm/entity-list-shell";

export default function PnlLoading() {
    return (
        <EntityListShell
            title="Profit & Loss"
            subtitle="An overview of your business's profitability."
            primaryAction={<Skeleton className="h-9 w-24" />}
        >
            <div className="flex w-full flex-col gap-6">
                <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow">
                    <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] p-4 rounded-lg flex flex-col items-center gap-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-6 w-32" />
                                    <Skeleton className="h-3 w-24" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] shadow">
                    <div className="p-6 flex justify-end">
                        <Skeleton className="h-9 w-32" />
                    </div>
                    <div className="p-6 pt-0">
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </EntityListShell>
    );
}
