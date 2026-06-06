import { Card, CardBody, CardHeader, CardTitle, Table, TBody, Td, Th, THead, Tr, Skeleton } from '@/components/sabcrm/20ui/compat';

export function TransactionSkeleton() {
    return (
        <Card className="border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 shadow-[var(--st-shadow-sm)]">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-[var(--st-text)] whitespace-nowrap">
                    <Skeleton className="h-7 w-[200px]" />
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Skeleton className="h-10 w-full sm:w-64" />
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Skeleton className="h-10 w-full sm:w-[130px]" />
                        <Skeleton className="h-10 w-full sm:w-[130px]" />
                    </div>
                </div>
            </CardHeader>
            <CardBody>
                <div className="border border-[var(--st-border)] rounded-md bg-[var(--st-bg-secondary)]/50 overflow-hidden shadow-[var(--st-shadow-sm)]">
                    <Table>
                        <THead>
                            <Tr>
                                <Th><Skeleton className="h-4 w-[120px]" /></Th>
                                <Th><Skeleton className="h-4 w-[160px]" /></Th>
                                <Th><Skeleton className="h-4 w-[80px]" /></Th>
                                <Th><Skeleton className="h-4 w-[80px]" /></Th>
                                <Th><Skeleton className="h-4 w-[80px]" /></Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Tr key={i}>
                                    <Td><Skeleton className="h-4 w-[150px]" /></Td>
                                    <Td><Skeleton className="h-4 w-[250px]" /></Td>
                                    <Td><Skeleton className="h-4 w-[60px]" /></Td>
                                    <Td><Skeleton className="h-6 w-[70px] rounded-full" /></Td>
                                    <Td><Skeleton className="h-6 w-[80px] rounded-full" /></Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </div>
            </CardBody>
        </Card>
    );
}
