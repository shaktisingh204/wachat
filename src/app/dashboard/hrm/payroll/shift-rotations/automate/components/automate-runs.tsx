'use client';

import { Card, Badge, Button } from '@/components/zoruui';
import { RotateCw, Download } from 'lucide-react';
import type { WsAutomateShift } from '@/lib/worksuite/shifts-types';
import { useEffect, useState } from 'react';

interface AutomateRunsProps {
  runs: WsAutomateShift[];
}

export default function AutomateRuns({ runs }: AutomateRunsProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleExportCSV = () => {
    if (!runs || runs.length === 0) return;
    
    const header = ['ID,Start Date,End Date,Employees Count,Status'];
    const rows = runs.map(r => {
      const start = new Date(r.start_date).toLocaleDateString();
      const end = new Date(r.end_date).toLocaleDateString();
      return `"${r._id}","${start}","${end}","${r.user_ids.length}","${r.status}"`;
    });
    
    const csv = [...header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `automate_runs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] text-zoru-ink">Recent Runs</h2>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={runs.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
      
      <div className="flex flex-col gap-2">
        {runs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-4 text-center text-[13px] text-zoru-ink-muted">
            No automation runs yet.
          </div>
        ) : (
          runs.map((r) => (
            <div
              key={String(r._id)}
              className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px]"
            >
              <RotateCw className="h-4 w-4 text-zoru-ink-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-zoru-ink">
                  {mounted ? new Date(r.start_date).toDateString() : ''} {mounted && '→'} {mounted ? new Date(r.end_date).toDateString() : ''}
                </div>
                <div className="truncate text-[11.5px] text-zoru-ink-muted">
                  {r.user_ids.length} employee{r.user_ids.length === 1 ? '' : 's'}
                </div>
              </div>
              <Badge
                variant={
                  r.status === 'completed' || r.status === 'running'
                    ? 'success'
                    : r.status === 'failed'
                    ? 'danger'
                    : 'secondary'
                }
              >
                {r.status}
              </Badge>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
