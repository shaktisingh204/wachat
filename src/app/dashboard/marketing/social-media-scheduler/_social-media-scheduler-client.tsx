'use client';

import React, { useState } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/zoruui';
import { Plus, Edit2, Trash2, Wand2, Loader2 } from 'lucide-react';
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
import { createSocialPost, updateSocialPost, deleteSocialPost, suggestOptimizations } from '@/app/actions/marketing/social-media-scheduler.actions';

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
  const [scheduledTime, setScheduledTime] = useState<any>("");
  const [tags, setTags] = useState<string>("");
  const [isSuggesting, setIsSuggesting] = useState(false);

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingItem(null);
    setPlatform("");
    setContent("");
    setStatus("");
    setScheduledTime("");
    setTags("");
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setPlatform(item.platform || "");
    setContent(item.content || "");
    setStatus(item.status || "");
    setScheduledTime(item.scheduledTime || "");
    setTags(item.tags ? item.tags.join(', ') : "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      platform,
      content,
      status,
      scheduledTime,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean)
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

  const handleSuggest = async () => {
    if (!content || !platform) {
      toast({ title: 'Notice', description: 'Please enter content and select a platform first.' });
      return;
    }
    
    setIsSuggesting(true);
    try {
      const res = await suggestOptimizations(content, platform);
      if (res.success && res.data) {
        if (res.data.suggestedTags) {
          setTags(res.data.suggestedTags.join(', '));
        }
        if (res.data.optimalPostingTime) {
          setScheduledTime(res.data.optimalPostingTime);
        }
        toast({ title: 'Success', description: 'Generated suggestions successfully.' });
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to generate suggestions.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'An unexpected error occurred during suggestion generation.', variant: 'destructive' });
    } finally {
      setIsSuggesting(false);
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
              
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="scheduledTime" className="text-right">Scheduled Time</Label>
                  <div className="col-span-3 flex flex-col gap-2">
                    <Input
                      id="scheduledTime"
                      type="text"
                      placeholder="e.g. 2023-11-05T14:30:00Z or Tuesday 10:00 AM"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tags" className="text-right">Tags</Label>
                  <div className="col-span-3 flex flex-col gap-2">
                    <Input
                      id="tags"
                      type="text"
                      placeholder="Comma-separated tags"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSuggest} 
                      disabled={isSuggesting || !content || !platform}
                      className="w-fit"
                    >
                      {isSuggesting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      Suggest Tags & Time
                    </Button>
                  </div>
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
                <ZoruTableHead className="capitalize">time</ZoruTableHead>
                <ZoruTableHead className="capitalize">tags</ZoruTableHead>
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

                    <ZoruTableCell>
                      {String(item.scheduledTime || '')}
                    </ZoruTableCell>

                    <ZoruTableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.tags?.map((tag: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
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
