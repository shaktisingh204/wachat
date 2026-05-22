'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/zoruui';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { 
  Table, 
  ZoruTableHeader, 
  ZoruTableBody, 
  ZoruTableRow, 
  ZoruTableHead, 
  ZoruTableCell 
} from '@/components/zoruui';
import { 
  Dialog, 
  ZoruDialogTrigger, 
  ZoruDialogContent, 
  ZoruDialogHeader, 
  ZoruDialogFooter, 
  ZoruDialogTitle 
} from '@/components/zoruui';
import { Input } from '@/components/zoruui';
import { Label } from '@/components/zoruui';
import { Badge } from '@/components/zoruui';
import { useZoruToast } from '@/components/zoruui';
import { createSocialPost, updateSocialPost, deleteSocialPost } from '@/app/actions/marketing/social-media-scheduler.actions';

export function SocialPostClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useZoruToast();
  
  // Form State
  const [platform, setPlatform] = useState<any>("");
  const [content, setContent] = useState<any>("");
  const [status, setStatus] = useState<any>("");

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingItem(null);
    setPlatform("");
    setContent("");
    setStatus("");
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setPlatform(item.platform || "");
    setContent(item.content || "");
    setStatus(item.status || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      platform,
      content,
      status
    };

    try {
      if (editingItem) {
        const res = await updateSocialPost(editingItem._id, payload);
        if (res.success) {
          setData(data.map(i => i._id === editingItem._id ? { ...i, ...payload } : i));
          toast({ title: 'Success', description: 'Record updated successfully.' });
          setIsDialogOpen(false);
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to update record.', variant: 'destructive' });
        }
      } else {
        const res = await createSocialPost(payload);
        if (res.success) {
          // Optimistically reload page or add
          window.location.reload();
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to create record.', variant: 'destructive' });
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    const res = await deleteSocialPost(id);
    if (res.success) {
      setData(data.filter(i => i._id !== id));
      toast({ title: 'Success', description: 'Record deleted.' });
    } else {
      toast({ title: 'Error', description: res.error || 'Failed to delete record.', variant: 'destructive' });
    }
  };

  return (
    <EntityListShell
      title="Social Media Posts"
      subtitle="Manage your Social Media Posts seamlessly."
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
      primaryAction={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <ZoruDialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </ZoruDialogTrigger>
          <ZoruDialogContent>
            <ZoruDialogHeader>
              <ZoruDialogTitle>{editingItem ? 'Edit Record' : 'Create New'}</ZoruDialogTitle>
            </ZoruDialogHeader>
            <div className="grid gap-4 py-4">
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="platform" className="text-right">platform</Label>
                  
                    <select
                      id="platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="col-span-3 flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zoru-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select option</option>
                      <option value="facebook">facebook</option>
                      <option value="twitter">twitter</option>
                      <option value="instagram">instagram</option>
                      <option value="linkedin">linkedin</option>
                    </select>
                  
                </div>
              
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="content" className="text-right">content</Label>
                  
                    <Input
                      id="content"
                      type="text"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="col-span-3"
                    />
                  
                </div>
              
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">status</Label>
                  
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="col-span-3 flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zoru-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select option</option>
                      <option value="scheduled">scheduled</option>
                      <option value="published">published</option>
                      <option value="failed">failed</option>
                    </select>
                  
                </div>
              
            </div>
            <ZoruDialogFooter>
              <Button disabled={loading} onClick={handleSave}>Save</Button>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </Dialog>
      }
    >
      {filteredData.length === 0 ? (
        <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          No records found.
        </div>
      ) : (
        <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface overflow-hidden">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead className="capitalize">platform</ZoruTableHead>
                <ZoruTableHead className="capitalize">content</ZoruTableHead>
                <ZoruTableHead className="capitalize">status</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filteredData.map((item) => (
                <ZoruTableRow key={item._id}>
                  
                    <ZoruTableCell>
                      {String(item.platform || '')}
                    </ZoruTableCell>
                  
                  
                    <ZoruTableCell>
                      {String(item.content || '')}
                    </ZoruTableCell>
                  
                  
                    <ZoruTableCell>
                      {String(item.status || '')}
                    </ZoruTableCell>
                  
                  <ZoruTableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Edit2 className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item._id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </div>
      )}
    </EntityListShell>
  );
}
