'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/sabcrm/20ui';
import { Plus, Edit2, Trash2, Wand2 } from 'lucide-react';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Label } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { useToast } from '@/components/sabcrm/20ui';
import { createUtmLink, updateUtmLink, deleteUtmLink, generateOptimalUtmTags } from '@/app/actions/marketing/utm-tracking.actions';

export function UtmLinkClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  
  // Form State
  const [url, setUrl] = useState<any>("");
  const [source, setSource] = useState<any>("");
  const [medium, setMedium] = useState<any>("");
  const [campaign, setCampaign] = useState<any>("");

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTags = async () => {
    setIsGenerating(true);
    try {
      const res = await generateOptimalUtmTags(url);
      if (res.success && res.data) {
        setSource(res.data.source);
        setMedium(res.data.medium);
        setCampaign(res.data.campaign);
        toast({ title: 'Success', description: 'Tags generated successfully!' });
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to generate tags.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const openNew = () => {
    setEditingItem(null);
    setUrl("");
    setSource("");
    setMedium("");
    setCampaign("");
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setUrl(item.url || "");
    setSource(item.source || "");
    setMedium(item.medium || "");
    setCampaign(item.campaign || "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      url,
      source,
      medium,
      campaign
    };

    try {
      if (editingItem) {
        const res = await updateUtmLink(editingItem._id, payload);
        if (res.success) {
          setData(data.map(i => i._id === editingItem._id ? { ...i, ...payload } : i));
          toast({ title: 'Success', description: 'Record updated successfully.' });
          setIsDialogOpen(false);
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to update record.', variant: 'destructive' });
        }
      } else {
        const res = await createUtmLink(payload);
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
    
    const res = await deleteUtmLink(id);
    if (res.success) {
      setData(data.filter(i => i._id !== id));
      toast({ title: 'Success', description: 'Record deleted.' });
    } else {
      toast({ title: 'Error', description: res.error || 'Failed to delete record.', variant: 'destructive' });
    }
  };

  return (
    <EntityListShell
      title="UTM Tracking"
      subtitle="Manage your UTM Tracking seamlessly."
      search={{ value: search, onChange: setSearch, placeholder: 'Search...' }}
      primaryAction={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Record' : 'Create New'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="url" className="text-right">url</Label>
                  
                  <div className="col-span-3 flex gap-2">
                    <Input
                      id="url"
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1"
                      placeholder="https://example.com"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleGenerateTags}
                      disabled={isGenerating}
                      title="AI Suggest Tags"
                    >
                      <Wand2 className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''} mr-2`} />
                      Suggest
                    </Button>
                  </div>
                </div>
              
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="source" className="text-right">source</Label>
                  
                    <Input
                      id="source"
                      type="text"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="col-span-3"
                    />
                  
                </div>
              
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="medium" className="text-right">medium</Label>
                  
                    <Input
                      id="medium"
                      type="text"
                      value={medium}
                      onChange={(e) => setMedium(e.target.value)}
                      className="col-span-3"
                    />
                  
                </div>
              
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="campaign" className="text-right">campaign</Label>
                  
                    <Input
                      id="campaign"
                      type="text"
                      value={campaign}
                      onChange={(e) => setCampaign(e.target.value)}
                      className="col-span-3"
                    />
                  
                </div>
              
            </div>
            <DialogFooter>
              <Button disabled={loading} onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {filteredData.length === 0 ? (
        <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed text-sm text-[var(--st-text-secondary)]">
          No records found.
        </div>
      ) : (
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th className="capitalize">url</Th>
                <Th className="capitalize">source</Th>
                <Th className="capitalize">medium</Th>
                <Th className="capitalize">campaign</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  
                    <Td>
                      {String(item.url || '')}
                    </Td>
                  
                  
                    <Td>
                      {String(item.source || '')}
                    </Td>
                  
                  
                    <Td>
                      {String(item.medium || '')}
                    </Td>
                  
                  
                    <Td>
                      {String(item.campaign || '')}
                    </Td>
                  
                  <Td className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Edit2 className="h-4 w-4 text-[var(--st-text)]" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item._id)}>
                      <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </EntityListShell>
  );
}
