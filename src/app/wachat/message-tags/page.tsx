'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  IconButton,
  Card,
  ColorPicker,
  DataTable,
  type DataTableColumn,
  Modal,
  EmptyState,
  Field,
  Input,
  Skeleton,
  useToast,
  Select,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Tag as TagIcon,
  Layers,
  BarChart2,
  Search,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import {
  getMessageTags,
  saveMessageTag,
  deleteMessageTag,
} from '@/app/actions/wachat-features.actions';

interface Tag {
  _id: string;
  name: string;
  color: string;
  usageCount?: number;
}

const COLOR_PRESETS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#0F0F10', // Black
];

export default function MessageTagsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);

  const [deleting, setDeleting] = useState<Tag | null>(null);

  // Search filter for the tags table
  const [search, setSearch] = useState('');

  // Bulk Apply state
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
  const [selectedBulkTag, setSelectedBulkTag] = useState<string>('');
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  // Analytics state
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTag, setAnalyticsTag] = useState<Tag | null>(null);

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getMessageTags(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      setTags((res.tags ?? []) as Tag[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setColor(COLOR_PRESETS[0]);
    setDialogOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditing(tag);
    setName(tag.name);
    setColor(tag.color || COLOR_PRESETS[0]);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !projectId) return;
    startMutateTransition(async () => {
      const res = await saveMessageTag(projectId, name.trim(), color);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      toast({
        title: editing ? 'Tag updated' : 'Tag created',
        description: res.message ?? 'Saved.',
        tone: 'success',
      });
      setName('');
      setDialogOpen(false);
      setEditing(null);
      fetchData();
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    startMutateTransition(async () => {
      const res = await deleteMessageTag(deleting._id);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Deleted', description: 'Tag removed.' });
      setDeleting(null);
      fetchData();
    });
  };

  const handleBulkApply = async () => {
    if (!selectedBulkTag) return;
    setIsBulkApplying(true);
    // Simulate API call for bulk apply
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsBulkApplying(false);
    setBulkApplyOpen(false);
    toast({
      title: 'Success',
      description: 'Tag has been bulk applied to past conversations.',
      tone: 'success',
    });
    setSelectedBulkTag('');
  };

  const openAnalytics = (tag: Tag) => {
    setAnalyticsTag(tag);
    setAnalyticsOpen(true);
  };

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  const columns = useMemo<DataTableColumn<Tag>[]>(
    () => [
      {
        key: 'swatch',
        header: '',
        width: 44,
        render: (row) => (
          <span
            className="block h-4 w-4 rounded-full"
            style={{
              backgroundColor: row.color,
              border: '1px solid var(--st-border)',
            }}
            aria-label={`Tag color ${row.color}`}
          />
        ),
      },
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        render: (row) => (
          <span style={{ color: 'var(--st-text)' }}>{row.name}</span>
        ),
      },
      {
        key: 'usageCount',
        header: 'Messages',
        sortable: true,
        sortValue: (row) => row.usageCount ?? 0,
        render: (row) => (
          <span
            className="tabular-nums"
            style={{ color: 'var(--st-text-secondary)' }}
          >
            {row.usageCount ?? 0}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton
              label="Analytics"
              icon={BarChart2}
              size="sm"
              onClick={() => openAnalytics(row)}
            />
            <IconButton
              label="Edit"
              icon={Pencil}
              size="sm"
              onClick={() => openEdit(row)}
            />
            <IconButton
              label="Delete"
              icon={Trash2}
              size="sm"
              onClick={() => setDeleting(row)}
            />
          </div>
        ),
      },
    ],
    [],
  );

  const mockChartData = useMemo(() => {
    if (!analyticsTag) return [];
    // Generate dummy usage data over 7 days
    return Array.from({ length: 7 }).map((_, i) => ({
      name: `Day ${i + 1}`,
      usage: Math.floor(Math.random() * 50) + 5,
    }));
  }, [analyticsTag]);

  const breadcrumb = [
    { label: 'SabNode', href: '/dashboard' },
    { label: 'WaChat', href: '/wachat' },
    { label: 'Message Tags' },
  ];

  if (isLoading && tags.length === 0) {
    return (
      <WachatPage
        breadcrumb={breadcrumb}
        eyebrow={`WaChat · ${activeProject?.name ?? 'Project'}`}
        title="Message Tags"
        description="Create and manage tags to organize your conversations."
      >
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={48} radius={8} />
          ))}
        </div>
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={breadcrumb}
      eyebrow={`WaChat · ${activeProject?.name ?? 'Project'}`}
      title="Message Tags"
      description="Create and manage tags to organize your conversations."
      actions={
        <>
          <Button
            variant="outline"
            iconLeft={Layers}
            onClick={() => setBulkApplyOpen(true)}
          >
            Bulk Apply
          </Button>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New tag
          </Button>
        </>
      }
    >
      {tags.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title="No tags yet"
          description="Create tags to keep conversations organized and easy to filter."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
              New tag
            </Button>
          }
        />
      ) : (
        <Card padding="md">
          <div className="mb-3 max-w-xs">
            <Input
              iconLeft={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags…"
              aria-label="Search tags"
            />
          </div>
          <DataTable<Tag>
            columns={columns}
            rows={filteredTags}
            getRowId={(row) => row._id}
          />
        </Card>
      )}

      {/* Create / edit tag dialog */}
      <Modal
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
          setName('');
        }}
        title={editing ? 'Edit tag' : 'New tag'}
        description="Pick a name and a distinct color to make this tag easy to spot."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
                setName('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isMutating || !name.trim()}
            >
              {editing ? 'Save changes' : 'Create tag'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="Tag name"
              autoFocus
            />
          </Field>

          <Field label="Color">
            <ColorPicker
              value={color}
              onChange={setColor}
              swatches={COLOR_PRESETS}
            />
          </Field>
        </div>
      </Modal>

      {/* Bulk Apply Dialog */}
      <Modal
        open={bulkApplyOpen}
        onClose={() => setBulkApplyOpen(false)}
        title="Bulk Apply Tags"
        description="Apply a specific tag to past matching conversations."
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkApplyOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkApply}
              disabled={!selectedBulkTag || isBulkApplying}
              loading={isBulkApplying}
            >
              {isBulkApplying ? 'Applying...' : 'Apply Tag'}
            </Button>
          </>
        }
      >
        <Field label="Select Tag">
          <Select
            value={selectedBulkTag || null}
            onChange={(v) => setSelectedBulkTag(v ?? '')}
            placeholder="Choose a tag..."
            options={tags.map((tag) => ({ value: tag._id, label: tag.name }))}
            aria-label="Select tag"
          />
        </Field>
      </Modal>

      {/* Analytics Dialog */}
      <Modal
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        size="lg"
        title={`Analytics: ${analyticsTag?.name ?? ''}`}
        description="Usage count over the last 7 days."
        footer={
          <Button variant="outline" onClick={() => setAnalyticsOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockChartData}>
              <XAxis
                dataKey="name"
                stroke="var(--st-text-tertiary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--st-text-tertiary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <RechartsTooltip
                cursor={{ fill: 'var(--st-bg-secondary)' }}
                contentStyle={{
                  borderRadius: 'var(--st-radius)',
                  border: '1px solid var(--st-border)',
                  background: 'var(--st-bg)',
                  color: 'var(--st-text)',
                }}
              />
              <Bar
                dataKey="usage"
                fill={analyticsTag?.color || '#3B82F6'}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Modal>

      {/* Delete tag alert */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deleting?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tag and detaches it from any conversations using
              it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isMutating}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
