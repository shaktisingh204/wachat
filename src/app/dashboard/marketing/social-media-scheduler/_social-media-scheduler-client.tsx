'use client';

import React, { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, Wand2, CalendarClock } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Card,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createSocialPost,
  updateSocialPost,
  deleteSocialPost,
  suggestOptimizations,
} from '@/app/actions/marketing/social-media-scheduler.actions';

const PLATFORM_OPTIONS = ['facebook', 'twitter', 'instagram', 'linkedin'];
const STATUS_OPTIONS = ['scheduled', 'published', 'failed'];

export function SocialPostClient({ initialData }: { initialData: any[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [platform, setPlatform] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [tags, setTags] = useState<string>('');

  const filteredData = initialData.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
  );

  const openNew = () => {
    setEditingItem(null);
    setPlatform('');
    setContent('');
    setStatus('');
    setScheduledTime('');
    setTags('');
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setPlatform(item.platform || '');
    setContent(item.content || '');
    setStatus(item.status || '');
    setScheduledTime(item.scheduledTime || '');
    setTags(item.tags ? item.tags.join(', ') : '');
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        platform,
        content,
        status,
        scheduledTime,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };

      try {
        if (editingItem) {
          const res = await updateSocialPost(editingItem._id, payload);
          if (res.success) {
            toast.success('Record updated successfully.');
            setIsDialogOpen(false);
          } else {
            toast.error(res.error || 'Failed to update record.');
          }
        } else {
          const res = await createSocialPost(payload);
          if (res.success) {
            toast.success('Record created successfully.');
            setIsDialogOpen(false);
          } else {
            toast.error(res.error || 'Failed to create record.');
          }
        }
      } catch (err) {
        toast.error('An unexpected error occurred.');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    startTransition(async () => {
      try {
        const res = await deleteSocialPost(id);
        if (res.success) {
          toast.success('Record deleted.');
        } else {
          toast.error(res.error || 'Failed to delete record.');
        }
      } catch (err) {
        toast.error('Failed to delete record.');
      }
    });
  };

  const handleSuggest = () => {
    if (!content || !platform) {
      toast.info('Please enter content and select a platform first.');
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
          toast.success('Generated suggestions successfully.');
        } else {
          toast.error(res.error || 'Failed to generate suggestions.');
        }
      } catch (err) {
        toast.error('An unexpected error occurred during suggestion generation.');
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
            <Button variant="primary" iconLeft={Plus} onClick={openNew}>
              Create New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Record' : 'Create New'}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <Field label="Platform">
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger aria-label="Platform">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Content">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                />
              </Field>

              <Field label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger aria-label="Status">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Scheduled Time">
                <Input
                  type="text"
                  placeholder="e.g. 2023-11-05T14:30:00Z or Tuesday 10:00 AM"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </Field>

              <Field label="Tags">
                <div className="flex flex-col gap-2">
                  <Input
                    type="text"
                    placeholder="Comma-separated tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    iconLeft={Wand2}
                    loading={isPending}
                    onClick={handleSuggest}
                    disabled={isPending || !content || !platform}
                    className="w-fit"
                  >
                    Suggest Tags &amp; Time
                  </Button>
                </div>
              </Field>
            </div>

            <DialogFooter>
              <Button variant="primary" loading={isPending} onClick={handleSave}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {filteredData.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No records found."
          description="Create your first scheduled post to get started."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={openNew}>
              Create New
            </Button>
          }
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th className="capitalize">Platform</Th>
                <Th className="capitalize">Content</Th>
                <Th className="capitalize">Status</Th>
                <Th className="capitalize">Time</Th>
                <Th className="capitalize">Tags</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  <Td>{String(item.platform || '')}</Td>
                  <Td>{String(item.content || '')}</Td>
                  <Td>{String(item.status || '')}</Td>
                  <Td>{String(item.scheduledTime || '')}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.tags?.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Edit record"
                        icon={Pencil}
                        size="sm"
                        disabled={isPending}
                        onClick={() => openEdit(item)}
                      />
                      <IconButton
                        label="Delete record"
                        icon={Trash2}
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDelete(item._id)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </EntityListShell>
  );
}
