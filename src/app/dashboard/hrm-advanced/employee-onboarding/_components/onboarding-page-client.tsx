'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { OnboardingTask } from '@/lib/hrm-advanced-types';
import { saveOnboardingTask, deleteOnboardingTask, bulkDeleteOnboardingTasks, bulkCompleteOnboardingTasks } from '@/app/actions/hrm-advanced/employee-onboarding';
import { useOnboardingWebsocket } from './use-onboarding-websocket';
import { toast } from 'sonner';
import { Button } from '@/components/zoruui';
import { Input } from '@/components/zoruui';
import { Checkbox } from '@/components/zoruui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/zoruui';
import { OnboardingForm } from './onboarding-form';
import { useVirtualizer } from '@tanstack/react-virtual';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, Plus, Trash, CheckCircle } from 'lucide-react';

export function OnboardingPageClient({ initialTasks }: { initialTasks: OnboardingTask[] }) {
  const { tasks, setTasks } = useOnboardingWebsocket(initialTasks);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OnboardingTask | null>(null);

  // Memoize expensive calculations: filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = t.taskName.toLowerCase().includes(search.toLowerCase()) || 
                            t.employeeId.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' 
                            ? true 
                            : statusFilter === 'completed' 
                              ? t.isCompleted 
                              : !t.isCompleted;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, search, statusFilter]);

  const parentRef = React.useRef<HTMLDivElement>(null);

  // Implement virtualized list for performance
  const rowVirtualizer = useVirtualizer({
    count: filteredTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // estimated row height
    overscan: 5,
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTasks.map(t => t._id!).filter(Boolean)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleSave = async (data: Partial<OnboardingTask>) => {
    // Optimistic UI update
    const tempId = data._id || `temp-${Date.now()}`;
    const isNew = !data._id;
    
    setTasks(prev => {
      if (isNew) {
        return [{ ...data, _id: tempId } as OnboardingTask, ...prev];
      }
      return prev.map(t => t._id === data._id ? { ...t, ...data } as OnboardingTask : t);
    });
    
    setIsFormOpen(false);
    
    try {
      await saveOnboardingTask(data);
      toast.success(isNew ? 'Task created successfully' : 'Task updated successfully');
    } catch (e: any) {
      // Revert optimistic update on error
      toast.error(`Failed to save task: ${e.message}`);
      setTasks(tasks); // revert to original state before optimistic update
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    // Optimistic delete
    setTasks(prev => prev.filter(t => t._id !== id));
    
    try {
      await deleteOnboardingTask(id);
      toast.success('Task deleted successfully');
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e: any) {
      toast.error(`Failed to delete task: ${e.message}`);
      setTasks(tasks); // revert
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} tasks?`)) return;

    const idsArray = Array.from(selectedIds);
    
    // Optimistic bulk delete
    setTasks(prev => prev.filter(t => !t._id || !selectedIds.has(t._id)));
    setSelectedIds(new Set());
    
    try {
      await bulkDeleteOnboardingTasks(idsArray);
      toast.success(`Deleted ${idsArray.length} tasks successfully`);
    } catch (e: any) {
      toast.error(`Bulk delete failed: ${e.message}`);
      setTasks(tasks); // revert
    }
  };

  const handleBulkComplete = async () => {
    if (selectedIds.size === 0) return;
    
    const idsArray = Array.from(selectedIds);
    
    // Optimistic bulk update
    setTasks(prev => prev.map(t => t._id && selectedIds.has(t._id) ? { ...t, isCompleted: true } : t));
    setSelectedIds(new Set());
    
    try {
      await bulkCompleteOnboardingTasks(idsArray);
      toast.success(`Marked ${idsArray.length} tasks as completed`);
    } catch (e: any) {
      toast.error(`Bulk update failed: ${e.message}`);
      setTasks(tasks); // revert
    }
  };

  const exportCSV = useCallback(() => {
    const csvData = filteredTasks.map(t => ({
      'Task Name': t.taskName,
      'Employee ID': t.employeeId,
      'Due Date': t.dueDate,
      'Completed': t.isCompleted ? 'Yes' : 'No'
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'onboarding-tasks.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to CSV');
  }, [filteredTasks]);

  const exportPDF = useCallback(() => {
    const doc = new jsPDF();
    doc.text('Employee Onboarding Tasks', 14, 15);
    
    const tableColumn = ["Task Name", "Employee ID", "Due Date", "Completed"];
    const tableRows = filteredTasks.map(t => [
      t.taskName, 
      t.employeeId, 
      t.dueDate, 
      t.isCompleted ? 'Yes' : 'No'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });

    doc.save('onboarding-tasks.pdf');
    toast.success('Exported to PDF');
  }, [filteredTasks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employee Onboarding</h1>
          <p className="text-muted-foreground">Manage and track onboarding tasks.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button 
            onClick={() => {
              setEditingTask(null);
              setIsFormOpen(true);
            }}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border">
        <div className="flex flex-1 gap-4 items-center">
          <Input 
            placeholder="Search tasks or employee IDs..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select 
            className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-w-[150px]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button variant="outline" size="sm" onClick={handleBulkComplete}>
              <CheckCircle className="mr-2 h-4 w-4" /> Complete
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-md">
        <div className="grid grid-cols-12 gap-4 p-4 border-b font-medium bg-muted/50 items-center">
          <div className="col-span-1 flex justify-center">
            <Checkbox 
              checked={selectedIds.size > 0 && selectedIds.size === filteredTasks.length}
              onCheckedChange={handleSelectAll}
            />
          </div>
          <div className="col-span-4">Task Name</div>
          <div className="col-span-3">Employee ID</div>
          <div className="col-span-2">Due Date</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        <div 
          ref={parentRef} 
          className="max-h-[600px] overflow-auto"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const task = filteredTasks[virtualRow.index];
              const isSelected = !!task._id && selectedIds.has(task._id);
              
              // Hydration safe date rendering
              const safeDate = task.dueDate ? task.dueDate.substring(0, 10) : 'N/A';
              
              return (
                <div
                  key={task._id || virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="grid grid-cols-12 gap-4 p-4 border-b hover:bg-muted/30 items-center transition-colors"
                >
                  <div className="col-span-1 flex justify-center">
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={(checked) => task._id && handleSelectOne(task._id, !!checked)}
                    />
                  </div>
                  <div className="col-span-4 font-medium truncate" title={task.taskName}>{task.taskName}</div>
                  <div className="col-span-3 text-sm truncate" title={task.employeeId}>{task.employeeId}</div>
                  <div className="col-span-2 text-sm text-muted-foreground">{safeDate}</div>
                  <div className="col-span-1 flex justify-center">
                    {task.isCompleted ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setEditingTask(task);
                        setIsFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => task._id && handleDelete(task._id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {filteredTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground h-[200px] w-full absolute">
                <p>No onboarding tasks found.</p>
                {(search || statusFilter !== 'all') && (
                  <Button variant="link" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
          </DialogHeader>
          <OnboardingForm 
            initialData={editingTask || undefined} 
            onSubmit={handleSave} 
            onCancel={() => setIsFormOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
