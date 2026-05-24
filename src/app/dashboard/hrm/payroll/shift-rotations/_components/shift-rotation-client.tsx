'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/zoruui';
import { useEffect, useState, useTransition, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Edit, Play, Plus, Trash2, Download, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  saveShiftRotation,
  deleteShiftRotation,
} from '@/app/actions/worksuite/shifts.actions';
import type { WsShiftRotation } from '@/lib/worksuite/shifts-types';
import { SafeDate } from './safe-date';

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
  // Use browser's print functionality as simple PDF export
  window.print();
}

function CreateRotationForm({
  onCreated
}: {
  onCreated: (r: Omit<WsShiftRotation, '_id'> & { _id: string }) => void
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Optimistic ID
    const tempId = `temp-${Date.now()}`;
    const newRot = { _id: tempId, name, description, is_active: true, userId: 'temp' };
    
    startTransition(async () => {
      // Optimistic Update
      onCreated(newRot);
      
      const res = await saveShiftRotation({ name, description, is_active: true });
      if (res.success) {
        toast.success('Shift rotation created successfully');
        setName('');
        setDescription('');
      } else {
        toast.error(res.error || 'Failed to create shift rotation');
      }
    });
  };

  return (
    <Card className="p-6 mb-6">
      <h2 className="mb-3 text-[16px] text-zoru-ink">Create Rotation</h2>
      <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[12px] text-zoru-ink-muted">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="2-2-3 rotation"
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[12px] text-zoru-ink-muted">Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            disabled={pending}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Add</span>
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Mock WebSocket hook for collaborative editing
function useCollaborativeUpdates(onUpdate: () => void) {
  useEffect(() => {
    // Simulated WS connection
    let mounted = true;
    const interval = setInterval(() => {
      // In a real app we'd trigger onUpdate only when a WS message arrives
      // For this mock, we just don't do anything destructive to avoid infinite loops,
      // but we might simulate a ping here.
    }, 15000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
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
      const data = await getShiftRotationsAction();
      setRotations(data);
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
    
    // Optimistic delete
    setRotations(prev => prev.filter(r => r._id !== id));
    
    startTransition(async () => {
      const res = await deleteShiftRotation(id);
      if (res.success) {
        toast.success('Deleted successfully');
      } else {
        toast.error(res.error || 'Failed to delete');
        load(); // rollback
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
          toast.error('Some deletions failed');
          load();
        } else {
          toast.success(`Deleted ${idsToDelete.length} items`);
        }
      } catch (err) {
        toast.error('Error during bulk delete');
        load();
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRotations.length && filteredRotations.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRotations.map(r => r._id!)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

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

        <div className="overflow-x-auto rounded-lg border border-zoru-line print:border-none print:shadow-none">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zoru-line bg-zoru-surface-2 print:bg-transparent">
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
              {filteredRotations.length > 0 ? (
                filteredRotations.map((r) => (
                  <tr key={String(r._id)} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
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
                    <td className="px-4 py-2.5 text-[13px] text-zoru-ink-muted">
                      {r.createdAt ? <SafeDate dateString={r.createdAt} /> : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={r.is_active ? 'success' : 'secondary'}>
                        {r.is_active ? 'active' : 'inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right print:hidden">
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
                ))
              ) : (
                <tr className="border-b border-zoru-line">
                  <td colSpan={6} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                    No rotations found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </EntityListShell>
  );
}
