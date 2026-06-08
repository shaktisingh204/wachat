import { Card, CardTitle, EmptyState, Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui';
import { Globe } from 'lucide-react';

export function GeoAnalyticsTable({ data }: { data: { country: string; count: number }[] }) {
  const total = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card padding="none" className="p-5 flex flex-col h-full max-h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
        <CardTitle className="text-[13px] text-[var(--st-text)] font-medium">
          Clicks by country
        </CardTitle>
      </div>
      {data.length > 0 ? (
        <div className="flex-1 overflow-auto pr-2">
          <Table density="compact" stickyHeader>
            <THead>
              <Tr>
                <Th>Country</Th>
                <Th align="right">Clicks</Th>
                <Th align="right">%</Th>
              </Tr>
            </THead>
            <TBody>
              {data.map((item, idx) => (
                <Tr key={idx}>
                  <Td truncate className="max-w-[120px]">{item.country || 'Unknown'}</Td>
                  <Td align="right" className="font-mono">{item.count.toLocaleString()}</Td>
                  <Td align="right" className="text-[var(--st-text-secondary)]">
                    {total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={Globe}
            title="No geographic data available"
            description="Country-level click data will appear here once your links start getting traffic."
          />
        </div>
      )}
    </Card>
  );
}
