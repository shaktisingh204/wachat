import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruSkeleton
} from '@/components/sabcrm/20ui/compat';

export function TransactionSkeleton() {
    return (
        <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
            <ZoruCardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <ZoruCardTitle className="text-zoru-ink whitespace-nowrap">
                    <ZoruSkeleton className="h-7 w-[200px]" />
                </ZoruCardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <ZoruSkeleton className="h-10 w-full sm:w-64" />
                    <div className="flex gap-2 w-full sm:w-auto">
                        <ZoruSkeleton className="h-10 w-full sm:w-[130px]" />
                        <ZoruSkeleton className="h-10 w-full sm:w-[130px]" />
                    </div>
                </div>
            </ZoruCardHeader>
            <ZoruCardContent>
                <div className="border border-zoru-line rounded-md bg-zoru-surface/50 overflow-hidden shadow-[var(--zoru-shadow-sm)]">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow>
                                <ZoruTableHead><ZoruSkeleton className="h-4 w-[120px]" /></ZoruTableHead>
                                <ZoruTableHead><ZoruSkeleton className="h-4 w-[160px]" /></ZoruTableHead>
                                <ZoruTableHead><ZoruSkeleton className="h-4 w-[80px]" /></ZoruTableHead>
                                <ZoruTableHead><ZoruSkeleton className="h-4 w-[80px]" /></ZoruTableHead>
                                <ZoruTableHead><ZoruSkeleton className="h-4 w-[80px]" /></ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <ZoruTableRow key={i}>
                                    <ZoruTableCell><ZoruSkeleton className="h-4 w-[150px]" /></ZoruTableCell>
                                    <ZoruTableCell><ZoruSkeleton className="h-4 w-[250px]" /></ZoruTableCell>
                                    <ZoruTableCell><ZoruSkeleton className="h-4 w-[60px]" /></ZoruTableCell>
                                    <ZoruTableCell><ZoruSkeleton className="h-6 w-[70px] rounded-full" /></ZoruTableCell>
                                    <ZoruTableCell><ZoruSkeleton className="h-6 w-[80px] rounded-full" /></ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}
