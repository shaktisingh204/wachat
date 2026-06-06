import { Card } from '@/components/sabcrm/20ui';
import { Globe } from 'lucide-react';

export function GeoAnalyticsTable({ data }: { data: { country: string; count: number }[] }) {
  const total = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="p-5 flex flex-col h-full max-h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="h-4 w-4 text-[var(--st-text-secondary)]" />
        <h3 className="text-[13px] text-[var(--st-text)] font-medium">Detailed Geographic Analytics</h3>
      </div>
      {data.length > 0 ? (
        <div className="flex-1 overflow-auto pr-2">
          <table className="w-full text-[13px] text-left">
            <thead className="sticky top-0 bg-white dark:bg-[var(--st-bg-secondary)] z-10">
              <tr>
                <th className="pb-2 font-medium text-[var(--st-text-secondary)]">Country</th>
                <th className="pb-2 font-medium text-[var(--st-text-secondary)] text-right">Clicks</th>
                <th className="pb-2 font-medium text-[var(--st-text-secondary)] text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--st-border)]">
              {data.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 text-[var(--st-text)] truncate max-w-[120px]">{item.country || 'Unknown'}</td>
                  <td className="py-2.5 text-[var(--st-text)] text-right font-mono">{item.count.toLocaleString()}</td>
                  <td className="py-2.5 text-[var(--st-text-secondary)] text-right">
                    {total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[13px] text-[var(--st-text-secondary)] border border-dashed rounded-lg">
          No geographic data available
        </div>
      )}
    </Card>
  );
}
