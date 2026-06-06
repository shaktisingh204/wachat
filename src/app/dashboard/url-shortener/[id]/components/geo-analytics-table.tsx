import { Card } from '@/components/sabcrm/20ui/compat';
import { Globe } from 'lucide-react';

export function GeoAnalyticsTable({ data }: { data: { country: string; count: number }[] }) {
  const total = data.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="p-5 flex flex-col h-full max-h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="h-4 w-4 text-zoru-ink-muted" />
        <h3 className="text-[13px] text-zoru-ink font-medium">Detailed Geographic Analytics</h3>
      </div>
      {data.length > 0 ? (
        <div className="flex-1 overflow-auto pr-2">
          <table className="w-full text-[13px] text-left">
            <thead className="sticky top-0 bg-white dark:bg-zoru-surface z-10">
              <tr>
                <th className="pb-2 font-medium text-zoru-ink-muted">Country</th>
                <th className="pb-2 font-medium text-zoru-ink-muted text-right">Clicks</th>
                <th className="pb-2 font-medium text-zoru-ink-muted text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zoru-line">
              {data.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 text-zoru-ink truncate max-w-[120px]">{item.country || 'Unknown'}</td>
                  <td className="py-2.5 text-zoru-ink text-right font-mono">{item.count.toLocaleString()}</td>
                  <td className="py-2.5 text-zoru-ink-muted text-right">
                    {total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[13px] text-zoru-ink-muted border border-dashed rounded-lg">
          No geographic data available
        </div>
      )}
    </Card>
  );
}
