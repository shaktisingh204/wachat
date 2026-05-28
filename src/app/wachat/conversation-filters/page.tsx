'use client';

import {
  useZoruToast,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Badge,
  EmptyState,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Filter,
  Plus,
  Trash2,
  Play,
  Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getConversationFilters, saveConversationFilter, deleteConversationFilter } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/conversation-filters — Saved filter presets, rebuilt on
 * ZoruUI primitives. The create-filter form lives inside a Sheet.
 */

import * as React from 'react';

export default function ConversationFiltersPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [filters, setFilters] = useState<any[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [form, setForm] = useState({
    name: '',
    status: '',
    tag: '',
    agent: '',
    dateFrom: '',
    dateTo: '',
  });
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getConversationFilters(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setFilters(res.filters ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    if (!form.name.trim() || !projectId) return;
    const conditions: Record<string, any> = {};
    if (form.status) conditions.status = form.status;
    if (form.tag) conditions.tag = form.tag;
    if (form.agent) conditions.agent = form.agent;
    if (form.dateFrom) conditions.dateFrom = form.dateFrom;
    if (form.dateTo) conditions.dateTo = form.dateTo;
    startMutateTransition(async () => {
      const res = await saveConversationFilter(
        projectId,
        form.name.trim(),
        conditions,
      );
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Filter Created', description: res.message });
      setForm({
        name: '',
        status: '',
        tag: '',
        agent: '',
        dateFrom: '',
        dateTo: '',
      });
      setShowSheet(false);
      fetchData();
    });
  };

  const handleDelete = (filterId: string) => {
    startMutateTransition(async () => {
      const res = await deleteConversationFilter(filterId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Deleted', description: 'Filter removed.' });
      fetchData();
    });
  };

  if (isLoading && filters.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zoru-ink-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Conversation Filters</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Conversation Filters
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Create saved filter presets to quickly find conversations.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowSheet(true)}>
          <Plus /> New Filter
        </Button>
      </div>

      {filters.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filters.map((f) => {
            const c = f.conditions || {};
            return (
              <Card key={f._id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] text-zoru-ink">{f.name}</h3>
                  <button
                    onClick={() => handleDelete(f._id)}
                    disabled={isMutating}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-danger transition-colors hover:bg-zoru-danger/10"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.status && <Badge variant="secondary">{c.status}</Badge>}
                  {c.tag && <Badge variant="info">{c.tag}</Badge>}
                  {c.agent && <Badge variant="secondary">{c.agent}</Badge>}
                  {(c.dateFrom || c.dateTo) && (
                    <Badge variant="secondary">
                      {c.dateFrom || '...'} - {c.dateTo || '...'}
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      toast({
                        title: 'Applied',
                        description: `Filter "${f.name}" applied.`,
                      })
                    }
                  >
                    <Play /> Apply
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Filter />}
          title="No saved filters yet"
          description="Save common search criteria to quickly find conversations."
          action={
            <Button size="sm" onClick={() => setShowSheet(true)}>
              <Plus /> Create your first filter
            </Button>
          }
        />
      )}

      {/* Create-filter sheet */}
      <Sheet open={showSheet} onOpenChange={setShowSheet}>
        <ZoruSheetContent side="right" className="w-full sm:max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Create filter</ZoruSheetTitle>
            <ZoruSheetDescription>
              Define criteria for a reusable conversation filter.
            </ZoruSheetDescription>
          </ZoruSheetHeader>

          <div className="mt-5 grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-name">Filter name *</Label>
              <Input
                id="filter-name"
                placeholder="My filter"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Any status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="open">Open</ZoruSelectItem>
                  <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                  <ZoruSelectItem value="resolved">Resolved</ZoruSelectItem>
                  <ZoruSelectItem value="closed">Closed</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-tag">Tag</Label>
              <Input
                id="filter-tag"
                placeholder="e.g. priority"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Agent</Label>
              <Select
                value={form.agent}
                onValueChange={(v) => setForm({ ...form, agent: v })}
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Any agent" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="unassigned">Unassigned</ZoruSelectItem>
                  <ZoruSelectItem value="me">Assigned to me</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-from">From</Label>
                <Input
                  id="filter-from"
                  type="date"
                  value={form.dateFrom}
                  onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="filter-to">To</Label>
                <Input
                  id="filter-to"
                  type="date"
                  value={form.dateTo}
                  onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                />
              </div>
            </div>
          </div>

          <ZoruSheetFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setShowSheet(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.name.trim() || isMutating}
            >
              {isMutating ? <Loader2 className="animate-spin" /> : null}
              Save Filter
            </Button>
          </ZoruSheetFooter>
        </ZoruSheetContent>
      </Sheet>

      <div className="h-6" />
    </div>
  );
}
