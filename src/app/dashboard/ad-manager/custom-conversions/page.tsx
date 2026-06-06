'use client';

import * as React from 'react';
import { z } from 'zod';
import {
  Button,
  IconButton,
  Card,
  CardBody,
  Alert,
  AlertDescription,
  AlertTitle,
  Skeleton,
  Badge,
  Input,
  Field,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Target,
  Plus,
  CircleAlert,
  RefreshCw,
  Trash2,
  Search,
  Download,
  Sparkles,
} from 'lucide-react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
import { listCustomConversions, listPixels } from '@/app/actions/ad-manager.actions';
import { createCustomConversion, deleteCustomConversion } from '@/app/actions/ad-manager-features.actions';

const EVENT_TYPES = [
  'PURCHASE', 'LEAD', 'COMPLETE_REGISTRATION', 'ADD_TO_CART',
  'INITIATE_CHECKOUT', 'SEARCH', 'VIEW_CONTENT',
] as const;

const conversionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  pixelId: z.string().min(1, 'Pixel is required'),
  eventName: z.string().min(1, 'Event type is required'),
  urlRule: z.string().min(1, 'URL rule is required'),
  defaultValue: z.string().optional(),
});

export default function CustomConversionsPage() {
  const { activeAccount } = useAdManager();
  const { toast } = useToast();
  const [conversions, setConversions] = React.useState<any[]>([]);
  const [pixels, setPixels] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [aiDialogOpen, setAiDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Search & Filter
  const [searchTerm, setSearchTerm] = React.useState('');

  // Hydration fix
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Form fields
  const [name, setName] = React.useState('');
  const [pixelId, setPixelId] = React.useState('');
  const [eventName, setEventName] = React.useState<string>('PURCHASE');
  const [urlRule, setUrlRule] = React.useState('');
  const [defaultValue, setDefaultValue] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // AI Prompt field
  const [aiPrompt, setAiPrompt] = React.useState('');

  const fetchData = React.useCallback(async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      const [convRes, pixRes] = await Promise.all([
        listCustomConversions(activeAccount.account_id),
        listPixels(activeAccount.account_id),
      ]);
      setConversions(convRes.data || []);
      setPixels(pixRes.data || []);
      // Reset selection when data is refreshed
      setSelectedIds(new Set());
    } catch (error) {
      toast.error({ title: 'Error', description: 'Failed to fetch conversions' });
    } finally {
      setLoading(false);
    }
  }, [activeAccount, toast]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setName('');
    setPixelId('');
    setEventName('PURCHASE');
    setUrlRule('');
    setDefaultValue('');
    setErrors({});
  };

  const handleCreate = async () => {
    if (!activeAccount) return;

    const result = conversionSchema.safeParse({ name, pixelId, eventName, urlRule, defaultValue });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach(e => {
        if (e.path[0]) newErrors[e.path[0] as string] = e.message;
      });
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.set('adAccountId', activeAccount.account_id);
      fd.set('name', name);
      fd.set('pixelId', pixelId);
      fd.set('eventName', eventName);
      fd.set('urlRule', urlRule);
      fd.set('defaultValue', defaultValue);

      const res = await createCustomConversion(null, fd);
      if (res.error) {
        toast.error({ title: 'Error', description: res.error });
      } else {
        toast.success({ title: 'Created', description: res.message || 'Custom conversion created.' });
        setDialogOpen(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      toast.error({ title: 'Error', description: 'Failed to create conversion' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteCustomConversion(id);
      if (res.success) {
        toast.success({ title: 'Deleted', description: 'Custom conversion deleted.' });
        setConversions(prev => prev.filter(c => c.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        toast.error({ title: 'Error', description: res.error || 'Failed to delete.' });
      }
    } catch (error) {
      toast.error({ title: 'Error', description: 'Failed to delete conversion' });
    }
    setDeleteId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedIds.size} custom conversion(s)?`);
    if (!confirmDelete) return;

    // Simulate bulk delete by deleting one by one (as batch is not available in API action)
    let successCount = 0;
    for (const id of Array.from(selectedIds)) {
      const res = await deleteCustomConversion(id);
      if (res.success) successCount++;
    }

    if (successCount > 0) {
      toast.success({ title: 'Deleted', description: `Successfully deleted ${successCount} conversions.` });
      fetchData();
    } else {
      toast.error({ title: 'Error', description: 'Failed to delete selected conversions.' });
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Event Type', 'Last Fired', 'Default Value'];
    const rows = filteredConversions.map(c => [
      c.id,
      `"${c.name}"`,
      c.custom_event_type || 'OTHER',
      c.last_fired_time || '',
      c.default_conversion_value || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'custom_conversions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAIGenerate = () => {
    if (!aiPrompt) {
      toast.error({ title: 'Validation', description: 'Please enter a prompt.' });
      return;
    }

    // Simple mock logic for AI Generation
    const promptLower = aiPrompt.toLowerCase();

    let generatedName = 'AI Generated Conversion';
    let generatedEvent = 'PURCHASE';
    let generatedRule = '/thank-you';

    if (promptLower.includes('lead') || promptLower.includes('sign up')) {
      generatedName = 'Lead Generation (AI)';
      generatedEvent = 'LEAD';
      generatedRule = '/welcome';
    } else if (promptLower.includes('cart')) {
      generatedName = 'Added to Cart (AI)';
      generatedEvent = 'ADD_TO_CART';
      generatedRule = '/cart';
    } else {
      generatedName = `${aiPrompt.substring(0, 15)}... (AI)`;
    }

    setName(generatedName);
    setEventName(generatedEvent);
    setUrlRule(generatedRule);

    if (pixels.length > 0) {
      setPixelId(pixels[0].id);
    }

    toast.success({ title: 'Generated', description: 'AI successfully drafted a custom conversion.' });
    setAiDialogOpen(false);
    setAiPrompt('');
    setDialogOpen(true);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredConversions.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const filteredConversions = conversions.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.custom_event_type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allSelected = filteredConversions.length > 0 && selectedIds.size === filteredConversions.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredConversions.length;

  if (!activeAccount) {
    return (
      <div className="space-y-6">
        <AmBreadcrumb page="Custom conversions" />
        <AmHeader
          title="Custom conversions"
          description="Define URL-based or rule-based conversion events without code changes."
        />
        <Alert tone="warning" icon={CircleAlert}>
          <AlertTitle>No ad account selected</AlertTitle>
          <AlertDescription>Pick an ad account to view custom conversions.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AmBreadcrumb page="Custom conversions" />
      <AmHeader
        title="Custom conversions"
        description="Define URL-based or rule-based conversion events without code changes."
        actions={
          <div className="flex items-center gap-2">
            <IconButton
              variant="outline"
              icon={Sparkles}
              label="AI conversion assistant"
              onClick={() => setAiDialogOpen(true)}
            />
            <IconButton
              variant="outline"
              icon={RefreshCw}
              label="Refresh conversions"
              onClick={fetchData}
              disabled={loading}
              className={loading ? 'animate-spin' : undefined}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem iconLeft={Download} onClick={handleExportCSV}>
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="danger"
                  iconLeft={Trash2}
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                >
                  Delete Selected ({selectedIds.size})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
              New conversion
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
          <Target className="h-4 w-4" aria-hidden="true" />
          <span>Conversions for {activeAccount.name || activeAccount.account_id}</span>
        </div>

        <div className="w-full sm:w-72">
          <Input
            type="search"
            placeholder="Search conversions..."
            aria-label="Search conversions"
            iconLeft={Search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card padding="none">
        <CardBody>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} />)}
            </div>
          ) : filteredConversions.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Target}
                title={conversions.length === 0 ? 'No custom conversions yet' : 'No matching conversions found'}
                description={
                  conversions.length === 0
                    ? 'Create a URL-based or rule-based conversion to start tracking events.'
                    : 'Try a different search term to find what you are looking for.'
                }
                action={
                  conversions.length === 0 ? (
                    <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
                      New conversion
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th width={48}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={isIndeterminate}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      aria-label="Select all"
                    />
                  </Th>
                  <Th>Name</Th>
                  <Th>Event type</Th>
                  <Th>Last fired</Th>
                  <Th>Default value</Th>
                  <Th width={64} />
                </Tr>
              </THead>
              <TBody>
                {filteredConversions.map((c) => (
                  <Tr key={c.id} selected={selectedIds.has(c.id)}>
                    <Td>
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onChange={(e) => toggleSelectOne(c.id, e.target.checked)}
                        aria-label={`Select ${c.name}`}
                      />
                    </Td>
                    <Td className="font-medium">
                      {c.name}
                      {c.description && (
                        <div className="text-xs text-[var(--st-text-secondary)]">{c.description}</div>
                      )}
                    </Td>
                    <Td>
                      <Badge variant="outline">{c.custom_event_type || 'OTHER'}</Badge>
                    </Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">
                      {mounted && c.last_fired_time
                        ? new Date(c.last_fired_time).toLocaleString()
                        : '-'}
                    </Td>
                    <Td className="tabular-nums">
                      {c.default_conversion_value || '-'}
                    </Td>
                    <Td>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        label={`Delete ${c.name}`}
                        onClick={() => setDeleteId(c.id)}
                      />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New custom conversion</DialogTitle>
            <DialogDescription>Create a URL-based or rule-based conversion event.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Name" required error={errors.name}>
              <Input
                placeholder="e.g. Thank-you page purchase"
                value={name}
                onChange={e => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: '' }); }}
              />
            </Field>
            <Field label="Pixel" required error={errors.pixelId}>
              <Select value={pixelId} onValueChange={(val) => { setPixelId(val); if (errors.pixelId) setErrors({ ...errors, pixelId: '' }); }}>
                <SelectTrigger aria-label="Pixel">
                  <SelectValue placeholder="Select a pixel" />
                </SelectTrigger>
                <SelectContent>
                  {pixels.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Event type" required error={errors.eventName}>
              <Select value={eventName} onValueChange={(val) => { setEventName(val); if (errors.eventName) setErrors({ ...errors, eventName: '' }); }}>
                <SelectTrigger aria-label="Event type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(e => (
                    <SelectItem key={e} value={e}>{e.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="URL rule (contains)" required error={errors.urlRule}>
              <Input
                placeholder="e.g. /thank-you"
                value={urlRule}
                onChange={e => { setUrlRule(e.target.value); if (errors.urlRule) setErrors({ ...errors, urlRule: '' }); }}
              />
            </Field>
            <Field label="Default conversion value">
              <Input
                type="number"
                placeholder="0"
                value={defaultValue}
                onChange={e => setDefaultValue(e.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
              AI Conversion Assistant
            </DialogTitle>
            <DialogDescription>Describe what you want to track, and AI will configure the conversion rule.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Field label="What would you like to track?">
              <Input
                placeholder="e.g. I want to track users who hit the summer sale confirmation page"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAIGenerate(); }}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" iconLeft={Sparkles} onClick={handleAIGenerate}>
              Generate Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete custom conversion?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
