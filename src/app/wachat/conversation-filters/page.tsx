'use client';

import {
  useToast,
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Select,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  Badge,
  EmptyState,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Filter,
  Plus,
  Trash2,
  Play } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { getConversationFilters, saveConversationFilter, deleteConversationFilter } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/conversation-filters — Saved filter presets, rebuilt on
 * 20ui primitives. The create-filter form lives inside a Drawer.
 */

export default function ConversationFiltersPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Filter Created', description: res.message, tone: 'success' });
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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Deleted', description: 'Filter removed.', tone: 'success' });
      fetchData();
    });
  };

  if (isLoading && filters.length === 0) {
    return (
      <WachatPage
        breadcrumb={[
          { label: 'SabNode', href: '/dashboard' },
          { label: 'WaChat', href: '/wachat' },
          { label: 'Conversation Filters' },
        ]}
        title="Conversation Filters"
        description="Create saved filter presets to quickly find conversations."
      >
        <div className="flex min-h-[300px] items-center justify-center">
          <Spinner />
        </div>
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Conversation Filters' },
      ]}
      title="Conversation Filters"
      description="Create saved filter presets to quickly find conversations."
      actions={
        <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setShowSheet(true)}>
          New Filter
        </Button>
      }
    >
      {filters.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filters.map((f) => {
            const c = f.conditions || {};
            return (
              <Card key={f._id} padding="lg">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] [color:var(--st-text)]">
                    {f.name}
                  </h3>
                  <IconButton
                    label="Delete"
                    icon={Trash2}
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(f._id)}
                    disabled={isMutating}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.status && <Badge tone="neutral">{c.status}</Badge>}
                  {c.tag && <Badge tone="info">{c.tag}</Badge>}
                  {c.agent && <Badge tone="neutral">{c.agent}</Badge>}
                  {(c.dateFrom || c.dateTo) && (
                    <Badge tone="neutral">
                      {c.dateFrom || '...'} - {c.dateTo || '...'}
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    iconLeft={Play}
                    onClick={() =>
                      toast({
                        title: 'Applied',
                        description: `Filter "${f.name}" applied.`,
                        tone: 'success',
                      })
                    }
                  >
                    Apply
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Filter}
          title="No saved filters yet"
          description="Save common search criteria to quickly find conversations."
          action={
            <Button variant="primary" size="sm" iconLeft={Plus} onClick={() => setShowSheet(true)}>
              Create your first filter
            </Button>
          }
        />
      )}

      {/* Create-filter drawer */}
      <Drawer open={showSheet} onOpenChange={setShowSheet} side="right">
        <DrawerContent side="right" className="w-full sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Create filter</DrawerTitle>
            <DrawerDescription>
              Define criteria for a reusable conversation filter.
            </DrawerDescription>
          </DrawerHeader>

          <div className="mt-5 grid gap-3">
            <Field label="Filter name" required>
              <Input
                placeholder="My filter"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status || null}
                onChange={(v) => setForm({ ...form, status: v ?? '' })}
                placeholder="Any status"
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
            </Field>
            <Field label="Tag">
              <Input
                placeholder="e.g. priority"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
              />
            </Field>
            <Field label="Agent">
              <Select
                value={form.agent || null}
                onChange={(v) => setForm({ ...form, agent: v ?? '' })}
                placeholder="Any agent"
                options={[
                  { value: 'unassigned', label: 'Unassigned' },
                  { value: 'me', label: 'Assigned to me' },
                ]}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input
                  type="date"
                  value={form.dateFrom}
                  onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
                />
              </Field>
              <Field label="To">
                <Input
                  type="date"
                  value={form.dateTo}
                  onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <DrawerFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setShowSheet(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={isMutating}
              disabled={!form.name.trim() || isMutating}
            >
              Save Filter
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </WachatPage>
  );
}
