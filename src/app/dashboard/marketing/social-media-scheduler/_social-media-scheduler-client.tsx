'use client';

import React, { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button } from '@/components/sabcrm/20ui';
import { Plus, Edit2, Trash2, Wand2, Loader2 } from 'lucide-react';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { Label } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { useToast } from '@/components/sabcrm/20ui';
import { createSocialPost, updateSocialPost, deleteSocialPost, suggestOptimizations } from '@/app/actions/marketing/social-media-scheduler.actions';

export function SocialPostClient({ initialData }: { initialData: any[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  // Form State
  const [platform, setPlatform] = useState<any>("");
  const [content, setContent] = useState<any>("");
  const [status, setStatus] = useState<any>("");
  const [scheduledTime, setScheduledTime] = useState<any>("");
  const [tags, setTags] = useState<string>("");

  const filteredData = initialData.filter(item => 
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

  const handleSave = () => {
    startTransition(async () => {
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
            toast({ title: 'Success', description: 'Record updated successfully.' });
            setIsDialogOpen(false);
          } else {
            toast({ title: 'Error', description: res.error || 'Failed to update record.', variant: 'destructive' });
          }
        } else {
          const res = await createSocialPost(payload);
          if (res.success) {
            toast({ title: 'Success', description: 'Record created successfully.' });
            setIsDialogOpen(false);
          } else {
            toast({ title: 'Error', description: res.error || 'Failed to create record.', variant: 'destructive' });
          }
        }
      } catch (err) {
        toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    startTransition(async () => {
      try {
        const res = await deleteSocialPost(id);
        if (res.success) {
          toast({ title: 'Success', description: 'Record deleted.' });
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to delete record.', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to delete record.', variant: 'destructive' });
      }
    });
  };

  const handleSuggest = () => {
    if (!content || !platform) {
      toast({ title: 'Notice', description: 'Please enter content and select a platform first.' });
      return;
    }
    
    startTransition(async () => {
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
      }
    });
  };

  return (
    <EntityListShell
      title="Social Media Posts"
      subtitle="Manage your Social Media Posts seamlessly."
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
                  <Label htmlFor="platform" className="text-right">platform</Label>
                  
                    <select
                      id="platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="col-span-3 flex h-9 w-full rounded-md border border-[var(--st-border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--st-accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="col-span-3 flex h-9 w-full rounded-md border border-[var(--st-border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--st-accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
                      disabled={isPending || !content || !platform}
                      className="w-fit"
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      Suggest Tags & Time
                    </Button>
                  </div>
                </div>
              
            </div>
            <DialogFooter>
              <Button disabled={isPending} onClick={handleSave}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
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
                <Th className="capitalize">platform</Th>
                <Th className="capitalize">content</Th>
                <Th className="capitalize">status</Th>
                <Th className="capitalize">time</Th>
                <Th className="capitalize">tags</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  
                    <Td>
                      {String(item.platform || '')}
                    </Td>
                  
                  
                    <Td>
                      {String(item.content || '')}
                    </Td>
                  
                  
                    <Td>
                      {String(item.status || '')}
                    </Td>

                    <Td>
                      {String(item.scheduledTime || '')}
                    </Td>

                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {item.tags?.map((tag: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </Td>
                  
                  <Td className="text-right space-x-2">
                    <Button variant="ghost" size="icon" disabled={isPending} onClick={() => openEdit(item)}>
                      <Edit2 className="h-4 w-4 text-[var(--st-text)]" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={isPending} onClick={() => handleDelete(item._id)}>
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
