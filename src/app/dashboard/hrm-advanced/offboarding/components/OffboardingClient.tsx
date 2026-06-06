'use client';

import React, { useState, useMemo, useOptimistic, useEffect, useRef } from 'react';
import { OffboardingTask } from '@/lib/hrm-advanced-types';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Input, Table, THead, TBody, Tr, Th, Td, EmptyState } from '@/components/sabcrm/20ui';
import { useToast } from '@/components/sabcrm/20ui';
import { OffboardingForm } from './OffboardingForm';
import { useVirtualizer } from '@tanstack/react-virtual';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OffboardingClientProps {
  initialTasks: OffboardingTask[];
  onSaveTask: (payload: Partial<OffboardingTask>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<any>;
  onBulkDeleteTasks?: (ids: string[]) => Promise<any>; // optional if not provided
}

type OptimisticAction = 
  | { type: 'ADD'; task: OffboardingTask }
  | { type: 'UPDATE'; task: OffboardingTask }
  | { type: 'DELETE'; id: string }
  | { type: 'BULK_DELETE'; ids: string[] }
  | { type: 'BULK_UPDATE'; ids: string[], updates: Partial<OffboardingTask> };

export function OffboardingClient({ initialTasks, onSaveTask, onDeleteTask }: OffboardingClientProps) {
  const { toast } = useToast();
  
  // Optimistic UI setup
  const [tasks, setTasks] = useState<OffboardingTask[]>(initialTasks);
  const [optimisticTasks, addOptimisticTask] = useOptimistic<OffboardingTask[], OptimisticAction>(
    tasks,
    (state, action) => {
      switch (action.type) {
        case 'ADD':
          return [...state, action.task];
        case 'UPDATE':
          return state.map(t => t._id === action.task._id ? { ...t, ...action.task } : t);
        case 'DELETE':
          return state.filter(t => t._id !== action.id);
        case 'BULK_DELETE':
          return state.filter(t => !action.ids.includes(t._id!));
        case 'BULK_UPDATE':
          return state.map(t => action.ids.includes(t._id!) ? { ...t, ...action.updates } : t);
        default:
          return state;
      }
    }
  );

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  // Mock WebSocket for collaborative editing
  useEffect(() => {
    const ws = new WebSocket('wss://echo.websocket.org');
    ws.onmessage = (event) => {
      console.log('Real-time update received:', event.data);
      // In a real app, we would parse this and update `tasks` state.
      // For now, we simulate receiving a ping just to show it's connected.
    };
    return () => ws.close();
  }, []);

  // Filtering
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredData = useMemo(() => {
    return optimisticTasks.filter(item => {
      const matchesSearch = item.taskName.toLowerCase().includes(search.toLowerCase()) || 
                            item.employeeId.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' 
        ? true 
        : statusFilter === 'COMPLETED' ? item.isCompleted : !item.isCompleted;
      return matchesSearch && matchesStatus;
    });
  }, [optimisticTasks, search, statusFilter]);

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52, // row height
    overscan: 5,
  });

  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<OffboardingTask> | undefined>(undefined);

  // Handlers
  const handleSave = async (data: Partial<OffboardingTask>) => {
    try {
      const isNew = !data._id;
      const optimisticPayload = { 
        ...data, 
        _id: data._id || `temp-${Date.now()}` 
      } as OffboardingTask;
      
      addOptimisticTask({ type: isNew ? 'ADD' : 'UPDATE', task: optimisticPayload });
      
      await onSaveTask(data);
      toast({ title: 'Success', description: `Task saved successfully.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      addOptimisticTask({ type: 'DELETE', id });
      await onDeleteTask(id);
      toast({ title: 'Success', description: `Task deleted.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} tasks?`)) return;
    try {
      const idsArray = Array.from(selectedIds);
      addOptimisticTask({ type: 'BULK_DELETE', ids: idsArray });
      
      // Since there's no bulk delete action provided, we do it in parallel
      await Promise.all(idsArray.map(id => onDeleteTask(id)));
      
      setSelectedIds(new Set());
      toast({ title: 'Success', description: `Tasks deleted.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete tasks', variant: 'destructive' });
    }
  };

  const handleBulkComplete = async () => {
    try {
      const idsArray = Array.from(selectedIds);
      addOptimisticTask({ type: 'BULK_UPDATE', ids: idsArray, updates: { isCompleted: true } });
      
      await Promise.all(
        idsArray.map(id => {
          const task = optimisticTasks.find(t => t._id === id);
          if (task) {
            return onSaveTask({ ...task, isCompleted: true });
          }
          return Promise.resolve();
        })
      );
      
      setSelectedIds(new Set());
      toast({ title: 'Success', description: `Tasks marked as completed.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update tasks', variant: 'destructive' });
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(d => d._id!)));
    }
  };

  // Exports
  const exportCSV = () => {
    const csv = Papa.unparse(filteredData.map(d => ({
      'Task Name': d.taskName,
      'Employee ID': d.employeeId,
      'Completed': d.isCompleted ? 'Yes' : 'No',
      'Due Date': new Date(d.dueDate).toLocaleDateString()
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'offboarding_tasks.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Offboarding Tasks', 14, 15);
    autoTable(doc, {
      head: [['Task Name', 'Employee ID', 'Completed', 'Due Date']],
      body: filteredData.map(d => [
        d.taskName,
        d.employeeId,
        d.isCompleted ? 'Yes' : 'No',
        new Date(d.dueDate).toLocaleDateString()
      ]),
      startY: 20
    });
    doc.save('offboarding_tasks.pdf');
  };

  return (
    <EntityListShell
      title="Offboarding"
      subtitle="Track exit interviews and equipment returns"
      search={{ value: search, onChange: setSearch, placeholder: `Search tasks...` }}
      primaryAction={
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>CSV</Button>
          <Button variant="outline" onClick={exportPDF}>PDF</Button>
          <Button onClick={() => { setEditingItem(undefined); setIsDialogOpen(true); }}>
            Add Task
          </Button>
        </div>
      }
      empty={
        filteredData.length === 0 ? (
          <EmptyState
            title="No tasks found"
            description="Get started by adding a new task."
            action={<Button onClick={() => { setEditingItem(undefined); setIsDialogOpen(true); }}>Add Task</Button>}
          />
        ) : undefined
      }
    >
      <div className="flex gap-4 items-center mb-4">
        <select 
          className="h-10 rounded-md border border-[var(--st-border)] bg-transparent px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="ALL">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
        </select>
        
        {selectedIds.size > 0 && (
          <div className="flex gap-2 items-center bg-[var(--st-bg-muted)] text-[var(--st-text)] px-3 py-1.5 rounded-md dark:bg-[var(--st-text)] dark:text-white">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={handleBulkComplete}>Mark Complete</Button>
            <Button variant="ghost" size="sm" className="text-[var(--st-text)] hover:text-[var(--st-text)] dark:text-[var(--st-text-secondary)]" onClick={handleBulkDelete}>Delete</Button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-[var(--st-border)] overflow-hidden flex flex-col h-[500px]">
        <div className="overflow-auto flex-1" ref={parentRef}>
          <Table>
            <THead className="sticky top-0 bg-white dark:bg-[var(--st-text)] z-10">
              <Tr>
                <Th className="w-[50px]">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                    onChange={toggleAll}
                  />
                </Th>
                <Th>Task Name</Th>
                <Th>Employee ID</Th>
                <Th>Completed</Th>
                <Th>Due Date</Th>
                <Th className="w-[120px] text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = filteredData[virtualRow.index];
                return (
                  <Tr 
                    key={row._id || virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <Td>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(row._id!)}
                        onChange={() => toggleSelection(row._id!)}
                      />
                    </Td>
                    <Td>{row.taskName}</Td>
                    <Td>{row.employeeId}</Td>
                    <Td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.isCompleted ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-white' : 'bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-white'}`}>
                        {row.isCompleted ? 'Yes' : 'No'}
                      </span>
                    </Td>
                    <Td>
                      {isMounted && row.dueDate ? new Date(row.dueDate).toLocaleDateString() : ''}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingItem(row); setIsDialogOpen(true); }}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]" onClick={() => handleDelete(row._id!)}>Del</Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      </div>

      <OffboardingForm
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editingItem}
        onSave={handleSave}
      />
    </EntityListShell>
  );
}
