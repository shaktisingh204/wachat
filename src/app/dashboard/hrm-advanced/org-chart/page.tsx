'use client';

import React, { useEffect, useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getOrgChartNodes, saveOrgChartNode, deleteOrgChartNode } from '@/app/actions/hrm-advanced/org-chart';
import { OrgChartNode } from '@/lib/hrm-advanced-types';
import { Button, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, Input, EmptyState } from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui/use-zoru-toast';

export default function OrgChartPage() {
  const [data, setData] = useState<OrgChartNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<OrgChartNode> | null>(null);
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const { toast } = useZoruToast();

  const loadData = () => {
    setIsLoading(true);
    getOrgChartNodes().then((res) => {
      setData(res || []);
      setIsLoading(false);
    }).catch(err => {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
      setIsLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    try {
      await saveOrgChartNode(editingItem as Partial<OrgChartNode>);
      toast({ title: 'Success', description: 'Node saved successfully.' });
      setIsDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this node?')) return;
    try {
      await deleteOrgChartNode(id);
      toast({ title: 'Success', description: 'Node deleted.' });
      loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const buildTree = (nodes: OrgChartNode[], parentId?: string): any[] => {
    return nodes
      .filter(n => (parentId ? n.managerId === parentId : (!n.managerId || n.managerId.trim() === '')))
      .map(n => ({ ...n, children: buildTree(nodes, n._id) }));
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
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zoru-ink-muted" onClick={() => { setEditingItem(node); setIsDialogOpen(true); }}>E</Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDelete(node._id)}>X</Button>
              </div>
            </div>
            {node.children.length > 0 && (
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

  const filteredData = data.filter(item => 
    Object.values(item).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );
  
  const treeData = buildTree(filteredData);

  return (
    <EntityListShell
      title="Dynamic Org Chart"
      subtitle="View and manage the organization structure"
      loading={isLoading}
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
      viewSwitcher={
        <div className="flex rounded-md border border-zoru-line bg-zoru-surface-hover p-1">
          <Button variant={view === 'tree' ? 'default' : 'ghost'} size="sm" onClick={() => setView('tree')}>Tree</Button>
          <Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setView('list')}>List</Button>
        </div>
      }
      primaryAction={
        <Button onClick={() => { setEditingItem({}); setIsDialogOpen(true); }}>
          Add Node
        </Button>
      }
      empty={
        <EmptyState
          title="No nodes found"
          description="Get started by adding a new organization node."
          action={<Button onClick={() => { setEditingItem({}); setIsDialogOpen(true); }}>Add Node</Button>}
        />
      }
    >
      {view === 'tree' ? (
        <div className="p-8 overflow-auto border border-zoru-line rounded-md bg-zoru-background/50 flex justify-center">
          {treeData.length > 0 ? renderTree(treeData) : <div className="text-zoru-ink-muted">No root nodes found</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredData.map(row => (
            <div key={row._id} className="rounded-xl border border-zoru-line p-4 bg-zoru-surface">
               <div className="font-semibold">{row.name}</div>
               <div className="text-sm text-zoru-ink-muted">{row.role} - {row.department}</div>
               <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditingItem(row); setIsDialogOpen(true); }}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(row._id!)}>Delete</Button>
               </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>{editingItem?._id ? 'Edit' : 'Add'} Node</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={editingItem?.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Role</label>
              <Input value={editingItem?.role || ''} onChange={e => setEditingItem({...editingItem, role: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Department</label>
              <Input value={editingItem?.department || ''} onChange={e => setEditingItem({...editingItem, department: e.target.value})} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Manager ID</label>
              <Input value={editingItem?.managerId || ''} onChange={e => setEditingItem({...editingItem, managerId: e.target.value})} />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}
