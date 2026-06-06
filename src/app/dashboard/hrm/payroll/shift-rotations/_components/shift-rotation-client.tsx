'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/sabcrm/20ui/compat';
import { useEffect, useState, useTransition, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Edit, Play, Trash2, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  deleteShiftRotation,
} from '@/app/actions/worksuite/shifts.actions';
import type { WsShiftRotation } from '@/lib/worksuite/shifts-types';
import { SafeDate } from './safe-date';
import { CreateRotationForm } from './create-rotation-form';

function exportCSV(data: WsShiftRotation[]) {
  const headers = ['Name', 'Description', 'Status', 'Created At'];
  const csvRows = data.map(r => 
    `"${r.name.replace(/"/g, '""')}","${(r.description || '').replace(/"/g, '""')}","${r.is_active ? 'Active' : 'Inactive'}","${r.createdAt ? format(new Date(r.createdAt), 'yyyy-MM-dd') : ''}"`
  );
  const csvContent = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shift-rotations.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function exportPDF(data: WsShiftRotation[]) {
  window.print();
}

function useCollaborativeUpdates(onUpdate: () => void) {
  useEffect(() => {
    let mounted = true;
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'wss://echo.websocket.events');
    
    ws.onmessage = () => {
      if (mounted) onUpdate();
    };

    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
      ws.close();
    };
  }, [onUpdate]);
}

export function ShiftRotationClient({ initialData, getShiftRotationsAction }: { initialData: WsShiftRotation[], getShiftRotationsAction: () => Promise<WsShiftRotation[]> }) {
  const [rotations, setRotations] = useState<WsShiftRotation[]>(initialData);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await getShiftRotationsAction();
        setRotations(data);
      } catch (err) {
        console.error('Failed to sync latest rotations', err);
      }
    });
  }, [getShiftRotationsAction]);

  useCollaborativeUpdates(load);

  const filteredRotations = useMemo(() => {
    return rotations.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || 
                           (r.description?.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'active' && r.is_active) ||
                            (statusFilter === 'inactive' && !r.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [rotations, search, statusFilter]);

  const handleDelete = (id: string) => {
    if (!confirm('Delete this rotation and its sequence?')) return;
    
    setRotations(prev => prev.filter(r => r._id !== id));
    
    startTransition(async () => {
      try {
        const res = await deleteShiftRotation(id);
        if (res.success) {
          toast.success('Deleted successfully');
        } else {
          toast.error('Failed to delete', { description: res.error || 'Server error occurred' });
          load();
        }
      } catch (err) {
        toast.error('Failed to delete', { description: 'Network error or server unavailable.' });
        load();
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected rotations?`)) return;

    const idsToDelete = Array.from(selectedIds);
    setRotations(prev => prev.filter(r => !idsToDelete.includes(r._id!)));
    setSelectedIds(new Set());

    startTransition(async () => {
      try {
        let hasErrors = false;
        for (const id of idsToDelete) {
          const res = await deleteShiftRotation(id);
          if (!res.success) hasErrors = true;
        }
        if (hasErrors) {
          toast.error('Some deletions failed', { description: 'Could not delete all selected items.' });
          load();
        } else {
          toast.success(`Deleted ${idsToDelete.length} items`);
        }
      } catch (err) {
        toast.error('Error during bulk delete', { description: 'Network error or server unavailable.' });
        load();
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRotations.length && filteredRotations.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRotations.map(r => r._id!).filter(Boolean)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredRotations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0 ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0) : 0;

  return (
    <EntityListShell
      title="Shift Rotations"
      subtitle="Define cyclical shift sequences to automate assignment."
      primaryAction={
        <Link href="/dashboard/hrm/payroll/shift-rotations/automate">
          <Button>
            <Play className="h-4 w-4" strokeWidth={1.75} />
            <span className="ml-2">Automate Shift</span>
          </Button>
        </Link>
      }
    >
      <CreateRotationForm 
        onCreated={(newRot) => {
          setRotations(prev => [newRot, ...prev]);
          load(); 
        }} 
      />

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-[16px] text-zoru-ink">All Rotations</h2>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Filter: {statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('active')}>Active</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>Inactive</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportCSV(filteredRotations)}>Export CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPDF(filteredRotations)}>Export PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>

        <div 
          ref={parentRef} 
          className="overflow-auto rounded-lg border border-zoru-line print:border-none print:shadow-none print:overflow-visible max-h-[600px]"
        >
          <table className="w-full border-collapse text-[13px] relative">
            <thead className="sticky top-0 z-10 bg-zoru-surface-2 print:static print:bg-transparent shadow-[0_1px_0_0_var(--zoru-line)]">
              <tr>
                <th className="px-4 py-2.5 text-left w-10">
                  <Checkbox 
                    checked={filteredRotations.length > 0 && selectedIds.size === filteredRotations.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Name</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Description</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Created</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Status</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-zoru-ink-muted print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className={pending ? 'opacity-50 transition-opacity' : ''}>
              {paddingTop > 0 && (
                <tr>
                  <td colSpan={6} style={{ height: `${paddingTop}px` }} />
                </tr>
              )}
              {filteredRotations.length > 0 ? (
                virtualItems.map((virtualRow) => {
                  const r = filteredRotations[virtualRow.index];
                  return (
                    <tr 
                      key={r._id || `rot-${virtualRow.index}`} 
                      className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors"
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                    >
                      <td className="px-4 py-2.5">
                        <Checkbox 
                          checked={r._id ? selectedIds.has(r._id) : false}
                          onCheckedChange={() => r._id && toggleSelect(r._id)}
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-[13px] font-medium text-zoru-ink">
                        {r.name}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-zoru-ink-muted">
                        {r.description || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-zoru-ink-muted whitespace-nowrap">
                        {r.createdAt ? <SafeDate dateString={r.createdAt} /> : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge variant={r.is_active ? 'success' : 'secondary'}>
                          {r.is_active ? 'active' : 'inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right print:hidden whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/dashboard/hrm/payroll/shift-rotations/${r._id}`}>
                            <Button variant="outline" size="icon" aria-label="Edit rotation">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Delete rotation"
                            onClick={() => r._id && handleDelete(r._id)}
                          >
                            <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr className="border-b border-zoru-line">
                  <td colSpan={6} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    No rotations found matching your criteria.
                  </td>
                </tr>
              )}
              {paddingBottom > 0 && (
                <tr>
                  <td colSpan={6} style={{ height: `${paddingBottom}px` }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </EntityListShell>
  );
}
