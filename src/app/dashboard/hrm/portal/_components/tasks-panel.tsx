'use client';

import { useTransition, useState, useMemo, useEffect, useOptimistic, useRef } from 'react';
import {
    Button,
    Badge,
    EmptyState,
    Input,
    Select,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSelectContent,
    ZoruSelectItem,
} from '@/components/sabcrm/20ui/compat';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { markTaskComplete } from '@/app/actions/hrm-portal.actions';
import { CheckCircle2, ClipboardList, Download, FileText, Search, CheckSquare } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

// ─── Priority badge helper ─────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: PortalTask['priority'] }) {
    const variant =
        priority === 'High'
            ? 'danger'
            : priority === 'Medium'
              ? 'warning'
              : 'secondary';
    return (
        <Badge variant={variant} className="text-[11px]">
            {priority}
        </Badge>
    );
}

function StatusBadge({ status }: { status: PortalTask['status'] }) {
    const variant =
        status === 'Completed'
            ? 'success'
            : status === 'In Progress'
              ? 'info'
              : 'secondary';
    return (
        <Badge variant={variant} className="text-[11px]">
            {status}
        </Badge>
    );
}

// Avoid hydration mismatches for dates
function ClientDate({ iso }: { iso: string | null }) {
    const [dateStr, setDateStr] = useState('—');

    useEffect(() => {
        if (!iso) {
            setDateStr('—');
            return;
        }
        setDateStr(fmtDate(iso));
    }, [iso]);

    return <>{dateStr}</>;
}

// ─── Export Utilities ─────────────────────────────────────────────────────────

function exportToCSV(data: any[], filename: string) {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val || ''}"`).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function exportToPDF(data: any[], filename: string) {
    const content = data.map(obj => Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ')).join('\n\n');
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

import { useRealtimeUpdates } from './use-realtime';
import { fmtDate } from '@/lib/utils';
import type { PortalTask } from '@/app/actions/hrm-portal.actions.types';

// ─── My Tasks (assigned to me) ────────────────────────────────────────────────

interface MyTasksTableProps {
    tasks: PortalTask[];
    onRefresh?: () => void;
}

export function MyTasksTable({ tasks, onRefresh }: MyTasksTableProps) {
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    const [optimisticTasks, addOptimisticTask] = useOptimistic(
        tasks,
        (state: PortalTask[], completedTaskIds: string[]) =>
            state.map(task => completedTaskIds.includes(task._id) ? { ...task, status: 'Completed' } : task)
    );

    useRealtimeUpdates('portal-tasks', () => {
        if (onRefresh) onRefresh();
    });

    const [search, setSearch] = useState('');
    const [priorityFilter, setPriorityFilter] = useState<string>('All');
    const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
    
    const filteredTasks = useMemo(() => {
        return optimisticTasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
            const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter;
            return matchesSearch && matchesPriority;
        });
    }, [optimisticTasks, search, priorityFilter]);

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: filteredTasks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52,
        overscan: 5,
    });

    function toggleSelection(id: string) {
        setSelectedTasks(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleAll() {
        if (selectedTasks.size === filteredTasks.length && filteredTasks.length > 0) {
            setSelectedTasks(new Set());
        } else {
            setSelectedTasks(new Set(filteredTasks.map(t => t._id)));
        }
    }

    function handleComplete(taskIds: string[]) {
        startTransition(async () => {
            addOptimisticTask(taskIds);
            
            let allSuccess = true;
            for (const id of taskIds) {
                const result = await markTaskComplete(id);
                if (!result.success) allSuccess = false;
            }

            if (allSuccess) {
                toast({ title: 'Tasks completed', description: `Successfully marked ${taskIds.length} task(s) as complete.` });
                setSelectedTasks(new Set());
                onRefresh?.();
            } else {
                toast({
                    title: 'Partial completion',
                    description: 'Some tasks could not be completed.',
                    variant: 'destructive',
                });
                onRefresh?.();
            }
        });
    }

    const handleExportCSV = () => {
        const exportData = filteredTasks.map(t => ({
            Title: t.title,
            AssignedBy: t.createdByName || '—',
            Due: t.dueDate || '—',
            Priority: t.priority,
            Status: t.status,
        }));
        exportToCSV(exportData, 'My_Tasks');
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex gap-2 items-center flex-1 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                        <Input
                            placeholder="Search tasks..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                        <ZoruSelectTrigger className="w-[130px]">
                            <ZoruSelectValue placeholder="Priority" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="All">All Priorities</ZoruSelectItem>
                            <ZoruSelectItem value="High">High</ZoruSelectItem>
                            <ZoruSelectItem value="Medium">Medium</ZoruSelectItem>
                            <ZoruSelectItem value="Low">Low</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    {selectedTasks.size > 0 && (
                        <Button 
                            variant="default" 
                            size="sm" 
                            disabled={isPending}
                            onClick={() => handleComplete(Array.from(selectedTasks))}
                        >
                            <CheckSquare className="mr-1.5 h-4 w-4" /> 
                            Complete Selected ({selectedTasks.size})
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="mr-1.5 h-4 w-4" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportToPDF(filteredTasks, 'My_Tasks')}>
                        <FileText className="mr-1.5 h-4 w-4" /> PDF
                    </Button>
                </div>
            </div>

            {filteredTasks.length === 0 ? (
                <EmptyState
                    icon={<ClipboardList className="h-7 w-7" />}
                    title={tasks.length === 0 ? "All caught up" : "No results found"}
                    description={tasks.length === 0 ? "No open tasks are assigned to you right now." : "Try adjusting your search or filters."}
                />
            ) : (
                <div className="rounded-lg border border-zoru-line overflow-hidden">
                    <div className="bg-zoru-surface-2 border-b border-zoru-line grid grid-cols-[40px_2fr_1fr_1fr_1fr_100px] px-4 py-3 text-[12px] uppercase text-zoru-ink-muted font-medium">
                        <div className="flex items-center">
                            <input 
                                type="checkbox" 
                                className="rounded border-zoru-line text-zoru-primary focus:ring-zoru-primary"
                                checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                                onChange={toggleAll}
                            />
                        </div>
                        <div>Title</div>
                        <div>Assigned by</div>
                        <div>Due</div>
                        <div>Priority/Status</div>
                        <div className="text-right">Actions</div>
                    </div>
                    <div 
                        ref={parentRef} 
                        className="max-h-[400px] overflow-auto"
                        style={{ height: `${Math.min(filteredTasks.length * 52, 400)}px` }}
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
                                return (
                                    <div
                                        key={task._id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_100px] items-center px-4 border-b border-zoru-line/50 hover:bg-zoru-surface-2/50 transition-colors bg-zoru-bg"
                                    >
                                        <div className="flex items-center">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-zoru-line text-zoru-primary focus:ring-zoru-primary"
                                                checked={selectedTasks.has(task._id)}
                                                onChange={() => toggleSelection(task._id)}
                                            />
                                        </div>
                                        <div className="font-medium text-zoru-ink pr-4">
                                            <span className="line-clamp-2 text-[13px]">{task.title}</span>
                                        </div>
                                        <div className="text-[13px] text-zoru-ink-muted">
                                            {task.createdByName ?? '—'}
                                        </div>
                                        <div className="text-[13px] text-zoru-ink-muted whitespace-nowrap">
                                            <ClientDate iso={task.dueDate} />
                                        </div>
                                        <div className="flex gap-2">
                                            <PriorityBadge priority={task.priority} />
                                            <StatusBadge status={task.status} />
                                        </div>
                                        <div className="flex justify-end">
                                            {task.status !== 'Completed' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1.5 text-[12px]"
                                                    disabled={isPending}
                                                    onClick={() => handleComplete([task._id])}
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Done
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Tasks I Assigned (created by me) ────────────────────────────────────────

interface MyCreatedTasksTableProps {
    tasks: PortalTask[];
}

export function MyCreatedTasksTable({ tasks }: MyCreatedTasksTableProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    
    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [tasks, search, statusFilter]);

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: filteredTasks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52,
        overscan: 5,
    });

    const handleExportCSV = () => {
        const exportData = filteredTasks.map(t => ({
            Title: t.title,
            Assignee: t.assignedToName || '—',
            Due: t.dueDate || '—',
            Priority: t.priority,
            Status: t.status,
        }));
        exportToCSV(exportData, 'Assigned_Tasks');
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex gap-2 items-center flex-1 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                        <Input
                            placeholder="Search assigned tasks..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <ZoruSelectTrigger className="w-[130px]">
                            <ZoruSelectValue placeholder="Status" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="All">All Statuses</ZoruSelectItem>
                            <ZoruSelectItem value="Pending">Pending</ZoruSelectItem>
                            <ZoruSelectItem value="In Progress">In Progress</ZoruSelectItem>
                            <ZoruSelectItem value="Completed">Completed</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                        <Download className="mr-1.5 h-4 w-4" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportToPDF(filteredTasks, 'Assigned_Tasks')}>
                        <FileText className="mr-1.5 h-4 w-4" /> PDF
                    </Button>
                </div>
            </div>

            {filteredTasks.length === 0 ? (
                <EmptyState
                    icon={<ClipboardList className="h-7 w-7" />}
                    title={tasks.length === 0 ? "No tasks assigned yet" : "No results found"}
                    description={tasks.length === 0 ? "Tasks you assign to your team members will appear here." : "Try adjusting your search or filters."}
                />
            ) : (
                <div className="rounded-lg border border-zoru-line overflow-hidden">
                    <div className="bg-zoru-surface-2 border-b border-zoru-line grid grid-cols-6 px-4 py-3 text-[12px] uppercase text-zoru-ink-muted font-medium">
                        <div className="col-span-2">Title</div>
                        <div>Assignee</div>
                        <div>Due</div>
                        <div>Priority/Status</div>
                    </div>
                    <div 
                        ref={parentRef} 
                        className="max-h-[400px] overflow-auto"
                        style={{ height: `${Math.min(filteredTasks.length * 52, 400)}px` }}
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
                                return (
                                    <div
                                        key={task._id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        className="grid grid-cols-6 items-center px-4 border-b border-zoru-line/50 hover:bg-zoru-surface-2/50 transition-colors bg-zoru-bg"
                                    >
                                        <div className="col-span-2 font-medium text-zoru-ink pr-4">
                                            <span className="line-clamp-2 text-[13px]">{task.title}</span>
                                        </div>
                                        <div className="text-[13px] text-zoru-ink-muted">
                                            {task.assignedToName ?? '—'}
                                        </div>
                                        <div className="text-[13px] text-zoru-ink-muted whitespace-nowrap">
                                            <ClientDate iso={task.dueDate} />
                                        </div>
                                        <div className="flex gap-2 col-span-2">
                                            <PriorityBadge priority={task.priority} />
                                            <StatusBadge status={task.status} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
