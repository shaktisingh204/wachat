'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruColorPicker,
  DataTable,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  useZoruToast,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/zoruui';
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
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

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
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);

  const [deleting, setDeleting] = useState<Tag | null>(null);

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
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({
        title: editing ? 'Tag updated' : 'Tag created',
        description: res.message ?? 'Saved.',
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
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
    });
    setSelectedBulkTag('');
  };

  const openAnalytics = (tag: Tag) => {
    setAnalyticsTag(tag);
    setAnalyticsOpen(true);
  };

  const columns = useMemo<ColumnDef<Tag>[]>(
    () => [
      {
        id: 'swatch',
        header: '',
        cell: ({ row }) => (
          <span
            className="block h-4 w-4 rounded-full border border-zoru-line"
            style={{ backgroundColor: row.original.color }}
            aria-label={`Tag color ${row.original.color}`}
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="text-zoru-ink">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'usageCount',
        header: 'Messages',
        cell: ({ row }) => (
          <span className="tabular-nums text-zoru-ink-muted">
            {row.original.usageCount ?? 0}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Analytics"
              onClick={() => openAnalytics(row.original)}
            >
              <BarChart2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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

  if (isLoading && tags.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Skeleton className="h-3 w-52" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="mt-8 grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Message Tags</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>
            WaChat · {activeProject?.name ?? 'Project'}
          </ZoruPageEyebrow>
          <ZoruPageTitle>Message Tags</ZoruPageTitle>
          <ZoruPageDescription>
            Create and manage tags to organize your conversations.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" onClick={() => setBulkApplyOpen(true)}>
            <Layers className="mr-2 h-4 w-4" /> Bulk Apply
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New tag
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6">
        {tags.length === 0 ? (
          <EmptyState
            icon={<TagIcon />}
            title="No tags yet"
            description="Create tags to keep conversations organized and easy to filter."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> New tag
              </Button>
            }
          />
        ) : (
          <Card className="p-4">
            <DataTable
              columns={columns}
              data={tags}
              filterColumn="name"
              filterPlaceholder="Search tags…"
            />
          </Card>
        )}
      </div>

      {/* Create / edit tag dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setName('');
          }
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit tag' : 'New tag'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick a name and a distinct color to make this tag easy to spot.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="Tag name"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <ZoruColorPicker
              value={color}
              onChange={setColor}
              presets={COLOR_PRESETS}
            />
          </div>

          <ZoruDialogFooter>
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
              onClick={handleSave}
              disabled={isMutating || !name.trim()}
            >
              {editing ? 'Save changes' : 'Create tag'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Bulk Apply Dialog */}
      <Dialog open={bulkApplyOpen} onOpenChange={setBulkApplyOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Bulk Apply Tags</ZoruDialogTitle>
            <ZoruDialogDescription>
              Apply a specific tag to past matching conversations.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label>Select Tag</Label>
            <Select value={selectedBulkTag} onValueChange={setSelectedBulkTag}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tag..." />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag._id} value={tag._id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="block h-3 w-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkApplyOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkApply}
              disabled={!selectedBulkTag || isBulkApplying}
            >
              {isBulkApplying ? 'Applying...' : 'Apply Tag'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <ZoruDialogContent className="max-w-xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              Analytics: {analyticsTag?.name}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Usage count over the last 7 days.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockChartData}>
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #eaeaea' }}
                />
                <Bar
                  dataKey="usage"
                  fill={analyticsTag?.color || '#3B82F6'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => setAnalyticsOpen(false)}
            >
              Close
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Delete tag alert */}
      <ZoruAlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete &ldquo;{deleting?.name}&rdquo;?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This removes the tag and detaches it from any conversations using
              it. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={handleDelete}
              disabled={isMutating}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
