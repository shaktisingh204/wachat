'use client';

import { Card, Badge, Button, Checkbox, Input, Select, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/zoruui';
import { RotateCw, Download, Search, Trash2 } from 'lucide-react';
import type { WsAutomateShift } from '@/lib/worksuite/shifts-types';
import { useEffect, useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtDate } from '@/lib/utils';

interface AutomateRunsProps {
  runs: WsAutomateShift[];
  onDeleteRuns: (ids: string[]) => void;
}

export default function AutomateRuns({ runs, onDeleteRuns }: AutomateRunsProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredRuns = useMemo(() => {
    return runs.filter(r => {
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSearch = String(r._id).toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [runs, search, statusFilter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredRuns.map(r => String(r._id))));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    onDeleteRuns(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleExportCSV = () => {
    if (!filteredRuns || filteredRuns.length === 0) return;
    
    const header = ['ID,Start Date,End Date,Employees Count,Status'];
    const rows = filteredRuns.map(r => {
      const start = fmtDate(r.start_date);
      const end = fmtDate(r.end_date);
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

  const handleExportPDF = () => {
    if (!filteredRuns || filteredRuns.length === 0) return;
    const doc = new jsPDF();
    doc.text('Automate Shift Runs', 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['ID', 'Start Date', 'End Date', 'Employees', 'Status']],
      body: filteredRuns.map(r => [
        String(r._id).substring(0, 8) + '...',
        fmtDate(r.start_date),
        fmtDate(r.end_date),
        r.user_ids.length.toString(),
        r.status
      ]),
    });
    doc.save(`automate_runs_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <h2 className="text-[16px] text-zoru-ink">Recent Runs</h2>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="danger" size="sm" onClick={handleDeleteSelected}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredRuns.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredRuns.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
          <Input 
            placeholder="Search by ID..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="w-[150px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <ZoruSelectTrigger>
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All Statuses</ZoruSelectItem>
              <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
              <ZoruSelectItem value="running">Running</ZoruSelectItem>
              <ZoruSelectItem value="failed">Failed</ZoruSelectItem>
              <ZoruSelectItem value="scheduled">Scheduled</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
        </div>
      </div>

      {filteredRuns.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-zoru-surface-2 rounded-lg text-[13px]">
          <Checkbox 
            checked={selectedIds.size === filteredRuns.length && filteredRuns.length > 0} 
            onCheckedChange={(v) => handleSelectAll(Boolean(v))}
          />
          <span className="font-medium text-zoru-ink">Select All</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filteredRuns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-4 text-center text-[13px] text-zoru-ink-muted">
            No runs found.
          </div>
        ) : (
          filteredRuns.map((r) => (
            <div
              key={String(r._id)}
              className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px]"
            >
              <Checkbox 
                checked={selectedIds.has(String(r._id))}
                onCheckedChange={(v) => toggleSelect(String(r._id), Boolean(v))}
              />
              <RotateCw className="h-4 w-4 text-zoru-ink-muted hidden sm:block" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-zoru-ink">
                  {mounted ? new Date(r.start_date).toDateString() : ''} {mounted && '→'} {mounted ? new Date(r.end_date).toDateString() : ''}
                </div>
                <div className="truncate text-[11.5px] text-zoru-ink-muted">
                  ID: {String(r._id).substring(0, 8)}... • {r.user_ids.length} employee{r.user_ids.length === 1 ? '' : 's'}
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
