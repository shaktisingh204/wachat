'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Trash2, Search, Download, CheckSquare, Square, FileText } from 'lucide-react';
import { Button, Input, Label, Card, CardBody } from '@/components/sabcrm/20ui/compat';
import type { RoadmapPhase, RoadmapTask } from '@/app/actions/hrm-roadmaps.actions.types';
export type PhaseDraft = { id: string; name: string; tasks: RoadmapTask[] };

interface PhaseListProps {
  phases: PhaseDraft[];
  setPhases: React.Dispatch<React.SetStateAction<PhaseDraft[]>>;
}

export default function PhaseList({ phases, setPhases }: PhaseListProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filtering
  const filteredPhases = useMemo(() => {
    if (!search.trim()) return phases;
    const lowerSearch = search.toLowerCase();
    return phases.filter((p) => p.name.toLowerCase().includes(lowerSearch));
  }, [phases, search]);

  // Virtualizer for performance
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredPhases.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // height of a row
    overscan: 5,
  });

  const handleAddPhase = () => {
    setPhases((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', tasks: [] },
    ]);
  };

  const handleRemovePhase = (phaseId: string) => {
    setPhases((prev) => prev.filter((p) => p.id !== phaseId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(phaseId);
      return next;
    });
  };

  const handleUpdatePhaseName = (phaseId: string, name: string) => {
    setPhases((prev) =>
      prev.map((p) => (p.id === phaseId ? { ...p, name } : p))
    );
  };

  const handleToggleSelect = (phaseId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredPhases.length && filteredPhases.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPhases.map((p) => p.id)));
    }
  };

  const handleBulkDelete = () => {
    setPhases((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
  };

  const exportToCSV = () => {
    // Basic CSV export for phases and task counts
    const headers = ['Phase ID', 'Phase Name', 'Task Count'];
    const rows = phases.map((p) => [p.id, `"${p.name.replace(/"/g, '""')}"`, p.tasks.length.toString()]);
    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'phases.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    // Simple window.print() for PDF export of the view
    window.print();
  };

  const isAllSelected = filteredPhases.length > 0 && selectedIds.size === filteredPhases.length;

  return (
    <Card className="print:shadow-none print:border-none">
      <CardBody className="flex flex-col gap-4 pt-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-lg">Phases</Label>
          <div className="flex items-center gap-2 print:hidden">
            <Button type="button" variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportToPDF}>
              <FileText className="mr-1.5 h-4 w-4" /> PDF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleAddPhase}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Phase
            </Button>
          </div>
        </div>

        {/* Filters and Bulk Actions */}
        <div className="flex items-center justify-between gap-4 print:hidden">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
            <Input
              placeholder="Search phases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--st-text-secondary)]">{selectedIds.size} selected</span>
              <Button type="button" variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Bulk Delete
              </Button>
            </div>
          )}
        </div>

        {/* Virtualized List */}
        {phases.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">No phases yet — add at least one.</p>
        ) : filteredPhases.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary)]">No phases match your search.</p>
        ) : (
          <div className="border rounded-md">
            <div className="flex items-center gap-3 p-3 bg-[var(--st-bg-secondary)] border-b print:hidden">
              <button type="button" onClick={handleToggleSelectAll} className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]">
                {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </button>
              <span className="text-sm font-medium flex-1">Phase Name</span>
              <span className="text-sm font-medium w-20 text-right">Tasks</span>
              <span className="w-8"></span>
            </div>
            
            <div
              ref={parentRef}
              className="max-h-[400px] overflow-auto print:max-h-none print:overflow-visible"
              style={{
                height: `${Math.min(filteredPhases.length * 56, 400)}px`,
              }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const phase = filteredPhases[virtualRow.index];
                  const isSelected = selectedIds.has(phase.id);
                  
                  return (
                    <div
                      key={phase.id}
                      className="absolute top-0 left-0 w-full flex items-center gap-3 p-2 hover:bg-[var(--st-bg-secondary)]/50 border-b border-[var(--st-border-light)] last:border-0"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(phase.id)}
                        className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] print:hidden"
                      >
                        {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                      <span className="w-5 text-xs tabular-nums text-[var(--st-text-tertiary)] print:hidden">
                        {virtualRow.index + 1}.
                      </span>
                      <Input
                        placeholder={`Phase ${virtualRow.index + 1} name`}
                        value={phase.name}
                        onChange={(e) => handleUpdatePhaseName(phase.id, e.target.value)}
                        className="flex-1 print:border-none print:bg-transparent print:p-0"
                      />
                      <span className="whitespace-nowrap text-xs text-[var(--st-text-secondary)] w-20 text-right">
                        {phase.tasks.length} task{phase.tasks.length === 1 ? '' : 's'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemovePhase(phase.id)}
                        className="w-8 print:hidden"
                      >
                        <Trash2 className="h-4 w-4 text-[var(--st-text-secondary)] hover:text-[var(--st-danger)]" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
