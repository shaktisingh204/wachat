import { Card, CardBody, Table, TBody, Td, Th, THead, Tr, Skeleton } from '@/components/sabcrm/20ui';

export function TransactionSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--st-space-6)]" aria-busy="true">
      {/* Summary stat strip */}
      <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} variant="outlined" padding="none" className="h-[92px]" />
        ))}
      </div>

      <Card variant="outlined" padding="none">
        <CardBody className="flex flex-col gap-[var(--st-space-4)]">
          {/* Filters row */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton height={36} radius={8} className="flex-1" />
            <div className="flex gap-2">
              <Skeleton width={130} height={36} radius={8} />
              <Skeleton width={130} height={36} radius={8} />
              <Skeleton width={150} height={36} radius={8} />
              <Skeleton width={36} height={36} radius={8} />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
            <Table>
              <THead>
                <Tr>
                  <Th><Skeleton width={120} height={14} /></Th>
                  <Th><Skeleton width={160} height={14} /></Th>
                  <Th align="right"><Skeleton width={70} height={14} /></Th>
                  <Th><Skeleton width={70} height={14} /></Th>
                  <Th><Skeleton width={70} height={14} /></Th>
                </Tr>
              </THead>
              <TBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Tr key={i}>
                    <Td><Skeleton width={150} height={14} /></Td>
                    <Td><Skeleton width={240} height={14} /></Td>
                    <Td align="right"><Skeleton width={60} height={14} /></Td>
                    <Td><Skeleton width={80} height={22} radius={999} /></Td>
                    <Td><Skeleton width={72} height={22} radius={999} /></Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
