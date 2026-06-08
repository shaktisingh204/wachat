'use client';

import React, { useMemo, useState, useTransition } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Wand2,
  CalendarClock,
  Send,
  TriangleAlert,
  Share2,
  SearchX,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  StatCard,
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
  SearchInput,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
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

type StatusTone = 'info' | 'success' | 'danger' | 'neutral';

const STATUS_TONE: Record<string, StatusTone> = {
  scheduled: 'info',
  published: 'success',
  failed: 'danger',
};

interface SocialPost {
  _id: string;
  platform?: string;
  content?: string;
  status?: string;
  scheduledTime?: string;
  tags?: string[];
  [key: string]: unknown;
}

export function SocialPostClient({ initialData }: { initialData: SocialPost[] }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SocialPost | null>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form State
  const [platform, setPlatform] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [tags, setTags] = useState('');

  const filteredData = useMemo(
    () =>
      initialData.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
      ),
    [initialData, search],
  );

  const stats = useMemo(() => {
    const total = initialData.length;
    const scheduled = initialData.filter((p) => p.status === 'scheduled').length;
    const published = initialData.filter((p) => p.status === 'published').length;
    const failed = initialData.filter((p) => p.status === 'failed').length;
    return { total, scheduled, published, failed };
  }, [initialData]);

  const openNew = () => {
    setEditingItem(null);
    setPlatform('');
    setContent('');
    setStatus('');
    setScheduledTime('');
    setTags('');
    setIsDialogOpen(true);
  };

  const openEdit = (item: SocialPost) => {
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
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      try {
        if (editingItem) {
          const res = await updateSocialPost(editingItem._id, payload);
          if (res.success) {
            toast.success('Post updated.');
            setIsDialogOpen(false);
          } else {
            toast.error(res.error || 'Could not update the post.');
          }
        } else {
          const res = await createSocialPost(payload);
          if (res.success) {
            toast.success('Post scheduled.');
            setIsDialogOpen(false);
          } else {
            toast.error(res.error || 'Could not schedule the post.');
          }
        }
      } catch {
        toast.error('Something went wrong. Please try again.');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this scheduled post?')) return;

    startTransition(async () => {
      try {
        const res = await deleteSocialPost(id);
        if (res.success) {
          toast.success('Post deleted.');
        } else {
          toast.error(res.error || 'Could not delete the post.');
        }
      } catch {
        toast.error('Could not delete the post.');
      }
    });
  };

  const handleSuggest = () => {
    if (!content || !platform) {
      toast.info('Add content and pick a platform first.');
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
          toast.success('Suggestions applied.');
        } else {
          toast.error(res.error || 'Could not generate suggestions.');
        }
      } catch {
        toast.error('Could not generate suggestions.');
      }
    });
  };

  const dialog = (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" iconLeft={Plus} onClick={openNew}>
          Schedule post
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit post' : 'Schedule a post'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <Field label="Platform">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger aria-label="Platform">
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt} className="capitalize">
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
              placeholder="What do you want to share?"
            />
          </Field>

          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Status">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt} className="capitalize">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Scheduled time" help="An ISO timestamp or a plain time works.">
            <Input
              type="text"
              placeholder="2026-06-12T14:30:00Z or Tuesday 10:00 AM"
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
                Suggest tags and time
              </Button>
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={isPending} onClick={handleSave}>
            {editingItem ? 'Save changes' : 'Schedule post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="20ui mx-auto flex w-full max-w-[1180px] flex-col gap-[var(--st-space-5)] px-6 py-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Marketing</PageEyebrow>
          <PageTitle>Social media scheduler</PageTitle>
          <PageDescription>
            Plan posts across your channels and keep tabs on what is scheduled, live, or needs a retry.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{dialog}</PageActions>
      </PageHeader>

      <section aria-label="Posting overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total posts" value={stats.total.toLocaleString()} icon={Share2} accent="#3b7af5" />
        <StatCard label="Scheduled" value={stats.scheduled.toLocaleString()} icon={CalendarClock} accent="#7c3aed" />
        <StatCard label="Published" value={stats.published.toLocaleString()} icon={Send} accent="#1f9d55" />
        <StatCard label="Failed" value={stats.failed.toLocaleString()} icon={TriangleAlert} accent="#e0484e" />
      </section>

      <Card padding="none">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] px-4 py-3">
          <div>
            <CardTitle>Scheduled posts</CardTitle>
            <CardDescription>
              {filteredData.length} of {initialData.length} posts
            </CardDescription>
          </div>
          <div className="w-full sm:w-72">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search by content, tag, or platform"
              aria-label="Search scheduled posts"
            />
          </div>
        </CardHeader>

        {filteredData.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyState
              icon={search ? SearchX : CalendarClock}
              title={search ? 'No posts match your search' : 'No posts scheduled yet'}
              description={
                search
                  ? 'Try a different keyword, tag, or platform.'
                  : 'Schedule your first post to start filling your content calendar.'
              }
              action={
                search ? undefined : (
                  <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                    Schedule post
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Platform</Th>
                <Th>Content</Th>
                <Th>Status</Th>
                <Th>Scheduled</Th>
                <Th>Tags</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  <Td className="font-medium capitalize">{String(item.platform || '—')}</Td>
                  <Td className="max-w-[22rem] truncate text-[var(--st-text-secondary)]">
                    {String(item.content || '—')}
                  </Td>
                  <Td>
                    {item.status ? (
                      <Badge tone={STATUS_TONE[item.status] ?? 'neutral'} dot className="capitalize">
                        {item.status}
                      </Badge>
                    ) : (
                      <span className="text-[var(--st-text-secondary)]">—</span>
                    )}
                  </Td>
                  <Td className="tabular-nums text-[var(--st-text-secondary)]">
                    {String(item.scheduledTime || '—')}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {item.tags && item.tags.length > 0 ? (
                        item.tags.map((tag: string, idx: number) => (
                          <Badge key={idx} tone="neutral" kind="soft">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[var(--st-text-secondary)]">—</span>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Edit post"
                        icon={Pencil}
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => openEdit(item)}
                      />
                      <IconButton
                        label="Delete post"
                        icon={Trash2}
                        variant="ghost"
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
        )}
      </Card>
    </div>
  );
}
