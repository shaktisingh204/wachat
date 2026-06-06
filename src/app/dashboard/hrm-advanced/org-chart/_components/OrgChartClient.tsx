'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { OrgChartNode } from '@/lib/hrm-advanced-types';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, EmptyState, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, Checkbox, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { OrgChartForm } from './OrgChartForm';
import { saveOrgChartNode, deleteOrgChartNode } from '@/app/actions/hrm-advanced/org-chart';
import { Download, MoreVertical, Trash, Edit, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { List, type RowComponentProps } from 'react-window';

interface OrgChartClientProps {
  initialData: OrgChartNode[];
}

export function OrgChartClient({ initialData }: OrgChartClientProps) {
  const [data, setData] = useState<OrgChartNode[]>(initialData);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<OrgChartNode> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useZoruToast();

  // Mock WebSocket for collaborative editing
  useEffect(() => {
    const ws = new WebSocket('wss://echo.websocket.events');
    ws.onmessage = (event) => {
      // In a real app, parse event.data and update state
      // For this mock, we just listen to avoid unused vars
    };
    return () => ws.close();
  }, []);

  const departments = useMemo(() => {
    const deps = new Set(data.map(d => d.department));
    return ['All', ...Array.from(deps)];
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = Object.values(item).some(v => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchesDep = departmentFilter === 'All' || item.department === departmentFilter;
      return matchesSearch && matchesDep;
    });
  }, [data, search, departmentFilter]);

  const buildTree = useCallback((nodes: OrgChartNode[], parentId?: string): any[] => {
    return nodes
      .filter(n => (parentId ? n.managerId === parentId : (!n.managerId || n.managerId.trim() === '')))
      .map(n => ({ ...n, children: buildTree(nodes, n._id) }));
  }, []);

  const treeData = useMemo(() => buildTree(filteredData), [filteredData, buildTree]);

  const handleSave = async (formData: Partial<OrgChartNode>) => {
    setIsLoading(true);
    // Optimistic UI update
    const isEditing = !!formData._id;
    const tempId = formData._id || Date.now().toString();
    const optimisticNode = { ...formData, _id: tempId } as OrgChartNode;
    
    setData(prev => {
      if (isEditing) return prev.map(n => n._id === formData._id ? optimisticNode : n);
      return [...prev, optimisticNode];
    });
    
    try {
      const res = await saveOrgChartNode(formData);
      // Update with real ID if it was a new node
      if (!isEditing && res.data) {
        setData(prev => prev.map(n => n._id === tempId ? { ...optimisticNode, _id: res.data._id } : n));
      }
      toast({ title: 'Success', description: 'Node saved successfully.' });
      setIsDialogOpen(false);
    } catch (err: any) {
      // Revert optimistic update on failure (for simplicity, we just reload or show error here, real app might refetch)
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setData(initialData); // simple rollback
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this node?')) return;
    setData(prev => prev.filter(n => n._id !== id));
    try {
      await deleteOrgChartNode(id);
      toast({ title: 'Success', description: 'Node deleted.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setData(initialData); // rollback
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected nodes?`)) return;
    const idsToDelete = Array.from(selectedIds);
    setData(prev => prev.filter(n => !n._id || !selectedIds.has(n._id)));
    setSelectedIds(new Set());
    
    try {
      await Promise.all(idsToDelete.map(id => deleteOrgChartNode(id)));
      toast({ title: 'Success', description: 'Nodes deleted.' });
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to delete some nodes.', variant: 'destructive' });
    }
  };

  const toggleSelection = (id: string) => {
    const newSel = new Set(selectedIds);
    if (newSel.has(id)) newSel.delete(id);
    else newSel.add(id);
    setSelectedIds(newSel);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(d => d._id!)));
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Role', 'Department', 'Manager ID'];
    const rows = filteredData.map(n => [n.name, n.role, n.department, n.managerId || '']);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org-chart.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Name', 'Role', 'Department', 'Manager ID']],
      body: filteredData.map(n => [n.name, n.role, n.department, n.managerId || '']),
    });
    doc.save('org-chart.pdf');
  };

  const renderTree = (nodes: any[]) => {
    return (
      <div className="flex flex-col gap-4 items-center">
        {nodes.map(node => (
          <div key={node._id} className="flex flex-col items-center">
            <div className="rounded-xl border border-zoru-line bg-zoru-surface p-4 shadow-sm min-w-[200px] text-center relative group">
              <div className="font-semibold text-zoru-ink">{node.name}</div>
              <div className="text-xs text-zoru-ink-muted">{node.role}</div>
              <div className="text-xs text-zoru-brand mt-1">{node.department}</div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zoru-ink-muted" onClick={() => { setEditingItem(node); setIsDialogOpen(true); }}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zoru-ink" onClick={() => handleDelete(node._id)}>
                  <Trash className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {node.children && node.children.length > 0 && (
              <div className="flex flex-col items-center mt-4 border-t border-l border-r border-zoru-line rounded-t-lg pt-4 relative">
                <div className="absolute -top-4 w-px h-4 bg-zoru-line" />
                <div className="flex gap-4">
                  {renderTree(node.children)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Virtualized row component for list view
  const Row = ({ index, style }: RowComponentProps<object>) => {
    const row = filteredData[index];
    if (!row) return null;
    return (
      <div style={style} className="flex items-center px-4 border-b border-zoru-line hover:bg-zoru-surface-hover">
        <div className="w-12">
          <Checkbox checked={selectedIds.has(row._id!)} onCheckedChange={() => toggleSelection(row._id!)} />
        </div>
        <div className="flex-1 font-medium">{row.name}</div>
        <div className="flex-1 text-zoru-ink-muted">{row.role}</div>
        <div className="flex-1 text-zoru-ink-muted">{row.department}</div>
        <div className="w-24 flex justify-end gap-2">
          <Button size="icon" variant="ghost" onClick={() => { setEditingItem(row); setIsDialogOpen(true); }}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-zoru-ink" onClick={() => handleDelete(row._id!)}>
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <EntityListShell
      title="Dynamic Org Chart"
      subtitle="View and manage the organization structure"
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
      viewSwitcher={
        <div className="flex items-center gap-2">
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map(dep => (
                <SelectItem key={dep} value={dep}>{dep}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border border-zoru-line bg-zoru-surface-hover p-1">
            <Button variant={view === 'tree' ? 'default' : 'ghost'} size="sm" onClick={() => setView('tree')}>Tree</Button>
            <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')}>List</Button>
          </div>
        </div>
      }
      primaryAction={
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCSV}>Export to CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>Export to PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setEditingItem({}); setIsDialogOpen(true); }}>
            Add Node
          </Button>
        </div>
      }
      empty={
        filteredData.length === 0 ? (
          <EmptyState
            title="No nodes found"
            description="Get started by adding a new organization node."
            action={<Button onClick={() => { setEditingItem({}); setIsDialogOpen(true); }}>Add Node</Button>}
          />
        ) : undefined
      }
    >
      {filteredData.length > 0 && view === 'tree' && (
        <div className="p-8 overflow-auto border border-zoru-line rounded-md bg-zoru-background/50 flex justify-center min-h-[500px]">
          {treeData.length > 0 ? renderTree(treeData) : <div className="text-zoru-ink-muted">No root nodes found for current filters</div>}
        </div>
      )}

      {filteredData.length > 0 && view === 'list' && (
        <div className="border border-zoru-line rounded-md bg-zoru-surface">
          <div className="flex items-center px-4 py-3 border-b border-zoru-line bg-zoru-surface-hover font-semibold text-sm">
            <div className="w-12">
              <Checkbox 
                checked={selectedIds.size === filteredData.length && filteredData.length > 0} 
                onCheckedChange={toggleAll} 
              />
            </div>
            <div className="flex-1">Name</div>
            <div className="flex-1">Role</div>
            <div className="flex-1">Department</div>
            <div className="w-24 text-right">Actions</div>
          </div>
          <List
            defaultHeight={500}
            rowCount={filteredData.length}
            rowHeight={56}
            rowComponent={Row}
            rowProps={{}}
          />
        </div>
      )}

      <OrgChartForm
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editingItem}
        onSave={handleSave}
        isLoading={isLoading}
      />
    </EntityListShell>
  );
}
