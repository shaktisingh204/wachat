import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function CrmEmailLoading() {
    return (
        <EntityListShell
            title="Email"
            subtitle="Manage your inbox, email templates, and track analytics."
        >
            <div className="flex flex-col h-[800px] animate-pulse">
                {/* Top Navigation Skeleton */}
                <div className="flex border-b border-zoru-border mb-6 space-x-1">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="px-4 py-2">
                            <div className="h-5 w-24 bg-zoru-surface-2 rounded"></div>
                        </div>
                    ))}
                </div>

                {/* Content Area Skeleton */}
                <div className="flex-1 flex gap-4">
                    <div className="w-1/3 bg-white border border-zoru-border rounded-lg p-4 flex flex-col gap-4">
                        <div className="h-8 w-full bg-zoru-surface-2 rounded mb-4"></div>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="border-b border-zoru-border pb-4 last:border-0">
                                <div className="h-4 w-1/3 bg-zoru-surface-2 rounded mb-2"></div>
                                <div className="h-4 w-2/3 bg-zoru-surface-2 rounded mb-1"></div>
                                <div className="h-3 w-1/2 bg-zoru-surface-2 rounded"></div>
                            </div>
                        ))}
                    </div>
                    <div className="w-2/3 bg-white border border-zoru-border rounded-lg p-6 flex flex-col gap-6">
                        <div className="h-10 w-full bg-zoru-surface-2 rounded"></div>
                        <div className="h-6 w-1/3 bg-zoru-surface-2 rounded"></div>
                        <div className="flex-1 bg-zoru-surface-2 rounded mt-4"></div>
                    </div>
                </div>
            </div>
        </EntityListShell>
    );
}
