'use client';

import * as React from 'react';
import { z } from 'zod';
import {
  Button,
  Card,
  ZoruCardContent,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Skeleton,
  Badge,
  Input,
  Label,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Checkbox,
  DropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
} from '@/components/zoruui';
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
import { useToast } from '@/hooks/use-toast';
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
      toast({ title: 'Error', description: 'Failed to fetch conversions', variant: 'destructive' });
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
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Created', description: res.message || 'Custom conversion created.' });
        setDialogOpen(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create conversion', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteCustomConversion(id);
      if (res.success) {
        toast({ title: 'Deleted', description: 'Custom conversion deleted.' });
        setConversions(prev => prev.filter(c => c.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to delete.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete conversion', variant: 'destructive' });
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
      toast({ title: 'Deleted', description: `Successfully deleted ${successCount} conversions.` });
      fetchData();
    } else {
      toast({ title: 'Error', description: 'Failed to delete selected conversions.', variant: 'destructive' });
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
      toast({ title: 'Validation', description: 'Please enter a prompt.', variant: 'destructive' });
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
    
    toast({ title: 'Generated', description: 'AI successfully drafted a custom conversion.' });
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
        <Alert>
          <CircleAlert className="h-4 w-4" />
          <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
          <ZoruAlertDescription>Pick an ad account to view custom conversions.</ZoruAlertDescription>
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
            <Button variant="outline" size="icon" onClick={() => setAiDialogOpen(true)} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="outline">Actions</Button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onClick={handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem 
                  onClick={handleBulkDelete} 
                  disabled={selectedIds.size === 0}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedIds.size})
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
            <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New conversion
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span>Conversions for {activeAccount.name || activeAccount.account_id}</span>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search conversions..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <ZoruCardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead className="w-12">
                    <Checkbox 
                      checked={isIndeterminate ? "indeterminate" : allSelected}
                      onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                      aria-label="Select all"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead>Name</ZoruTableHead>
                  <ZoruTableHead>Event type</ZoruTableHead>
                  <ZoruTableHead>Last fired</ZoruTableHead>
                  <ZoruTableHead>Default value</ZoruTableHead>
                  <ZoruTableHead className="w-16" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {filteredConversions.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {conversions.length === 0 ? 'No custom conversions yet.' : 'No matching conversions found.'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filteredConversions.map((c) => (
                    <ZoruTableRow key={c.id}>
                      <ZoruTableCell>
                        <Checkbox 
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={(checked) => toggleSelectOne(c.id, !!checked)}
                          aria-label={`Select ${c.name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium">
                        {c.name}
                        {c.description && (
                          <div className="text-xs text-muted-foreground">{c.description}</div>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant="outline">{c.custom_event_type || 'OTHER'}</Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-xs text-muted-foreground">
                        {mounted && c.last_fired_time
                          ? new Date(c.last_fired_time).toLocaleString()
                          : '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="tabular-nums">
                        {c.default_conversion_value || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </Table>
          )}
        </ZoruCardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>New custom conversion</ZoruDialogTitle>
            <ZoruDialogDescription>Create a URL-based or rule-based conversion event.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input 
                placeholder="e.g. Thank-you page purchase" 
                value={name} 
                onChange={e => { setName(e.target.value); if (errors.name) setErrors({...errors, name: ''}); }} 
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Pixel *</Label>
              <Select value={pixelId} onValueChange={(val) => { setPixelId(val); if (errors.pixelId) setErrors({...errors, pixelId: ''}); }}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select a pixel" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {pixels.map(p => (
                    <ZoruSelectItem key={p.id} value={p.id}>{p.name} ({p.id})</ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
              {errors.pixelId && <p className="text-xs text-destructive">{errors.pixelId}</p>}
            </div>
            <div className="space-y-2">
              <Label>Event type *</Label>
              <Select value={eventName} onValueChange={(val) => { setEventName(val); if (errors.eventName) setErrors({...errors, eventName: ''}); }}>
                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  {EVENT_TYPES.map(e => (
                    <ZoruSelectItem key={e} value={e}>{e.replace(/_/g, ' ')}</ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
              {errors.eventName && <p className="text-xs text-destructive">{errors.eventName}</p>}
            </div>
            <div className="space-y-2">
              <Label>URL rule (contains) *</Label>
              <Input 
                placeholder="e.g. /thank-you" 
                value={urlRule} 
                onChange={e => { setUrlRule(e.target.value); if (errors.urlRule) setErrors({...errors, urlRule: ''}); }} 
              />
              {errors.urlRule && <p className="text-xs text-destructive">{errors.urlRule}</p>}
            </div>
            <div className="space-y-2">
              <Label>Default conversion value</Label>
              <Input 
                type="number" 
                placeholder="0" 
                value={defaultValue} 
                onChange={e => setDefaultValue(e.target.value)} 
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Conversion Assistant
            </ZoruDialogTitle>
            <ZoruDialogDescription>Describe what you want to track, and AI will configure the conversion rule.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>What would you like to track?</Label>
              <Input 
                placeholder="e.g. I want to track users who hit the summer sale confirmation page" 
                value={aiPrompt} 
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAIGenerate(); }}
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleAIGenerate}>
              Generate Rules
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <ZoruDialogContent className="max-w-sm">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Delete custom conversion?</ZoruDialogTitle>
            <ZoruDialogDescription>This action cannot be undone.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
