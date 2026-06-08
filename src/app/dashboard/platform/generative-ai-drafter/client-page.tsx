'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
  Badge,
  StatCard,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
  createGenerativeAIDraft,
  updateGenerativeAIDraftStatus,
  deleteGenerativeAIDraft,
} from '@/app/actions/platform/generative-ai-drafter.actions';
import type { GenerativeAIDraft } from '@/types/platform';
import {
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Bot,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Search,
  FileCheck2,
  FilePen,
} from 'lucide-react';

const STATUS_TONE: Record<string, BadgeTone> = {
  approved: 'success',
  rejected: 'danger',
  draft: 'neutral',
};

export default function GenerativeAIDrafterClientPage({
  initialData,
  total,
  currentPage,
  limit,
}: {
  initialData: GenerativeAIDraft[];
  total: number;
  currentPage: number;
  limit: number;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const [form, setForm] = useState<{
    entityType: string;
    aiModel: 'gpt-4' | 'claude';
    prompt: string;
  }>({
    entityType: 'email',
    aiModel: 'gpt-4',
    prompt: '',
  });

  const handleCreate = async () => {
    if (!form.prompt) return;
    startTransition(async () => {
      try {
        const mockContent = `Generated ${form.entityType} content using ${form.aiModel} based on: "${form.prompt}". \n\nDear customer,\nWe are excited to share... [AI Generated Content]`;

        await createGenerativeAIDraft({
          ...form,
          content: mockContent,
          status: 'draft',
        });
        toast.success('Draft generated');
        setDialogOpen(false);
        setForm({ entityType: 'email', aiModel: 'gpt-4', prompt: '' });
        router.refresh();
      } catch {
        toast.error('Error generating draft');
      }
    });
  };

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateGenerativeAIDraftStatus(id, status);
      toast.success(`Draft ${status}`);
      router.refresh();
    } catch {
      toast.error('Error updating draft');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteGenerativeAIDraft(id);
      toast.success('Draft deleted');
      router.refresh();
    } catch {
      toast.error('Error deleting draft');
    }
  };

  const stats = useMemo(() => {
    const approved = initialData.filter((d) => d.status === 'approved').length;
    const pending = initialData.filter((d) => d.status === 'draft').length;
    return { approved, pending };
  }, [initialData]);

  const filteredData = initialData.filter(
    (d) =>
      d.prompt.toLowerCase().includes(query.toLowerCase()) ||
      d.entityType.includes(query.toLowerCase()) ||
      (d.aiModel && d.aiModel.toLowerCase().includes(query.toLowerCase())),
  );

  const totalPages = Math.ceil(total / limit);

  const newButton = (
    <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
      New draft
    </Button>
  );

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform · AI</PageEyebrow>
          <PageTitle>Generative AI drafter</PageTitle>
          <PageDescription>
            Draft emails, proposals, and contracts with AI, then review and approve before they
            ship.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{newButton}</PageActions>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total drafts" value={total} icon={Bot} />
        <StatCard label="Approved (page)" value={stats.approved} icon={FileCheck2} />
        <StatCard label="Pending review" value={stats.pending} icon={FilePen} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-[var(--st-border)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
            <CardTitle>Drafts</CardTitle>
          </div>
          <div className="w-full sm:w-56">
            <Field label="Search drafts" className="[&_.u-field__label]:sr-only">
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search drafts…"
                iconLeft={Search}
              />
            </Field>
          </div>
        </CardHeader>

        {filteredData.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={query ? 'No matching drafts' : 'No drafts yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Generate your first AI draft to see it here.'
            }
            action={query ? undefined : newButton}
          />
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {filteredData.map((item) => (
              <Card
                key={item.id}
                variant="outlined"
                padding="lg"
                className="flex flex-col gap-5 md:flex-row"
              >
                <div className="flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Bot className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
                    <span className="text-sm font-semibold uppercase tracking-wide text-[var(--st-text)]">
                      {item.entityType}
                    </span>
                    <Badge tone={STATUS_TONE[item.status] ?? 'neutral'} dot>
                      {item.status}
                    </Badge>
                    {item.aiModel && (
                      <Badge tone="info" kind="soft" className="inline-flex items-center gap-1">
                        <Cpu className="h-3 w-3" aria-hidden="true" />
                        {item.aiModel === 'gpt-4' ? 'GPT-4' : 'Claude'}
                      </Badge>
                    )}
                  </div>
                  <p className="mb-3 text-sm font-medium text-[var(--st-text)]">
                    Prompt:{' '}
                    <span className="italic text-[var(--st-text-tertiary)]">"{item.prompt}"</span>
                  </p>
                  <div className="whitespace-pre-wrap rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] p-4 font-mono text-sm text-[var(--st-text)]">
                    {item.content}
                  </div>
                </div>
                <div className="flex flex-row items-center justify-end gap-2 border-t border-[var(--st-border)] pt-4 md:w-36 md:flex-col md:items-stretch md:border-l md:border-t-0 md:pl-4 md:pt-0">
                  {item.status === 'draft' && (
                    <>
                      <Button
                        variant="outline"
                        block
                        iconLeft={CheckCircle}
                        className="justify-start"
                        onClick={() => handleStatus(item.id, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        block
                        iconLeft={XCircle}
                        className="justify-start"
                        onClick={() => handleStatus(item.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    block
                    iconLeft={Trash2}
                    className="justify-start text-[var(--st-danger)]"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--st-border)] px-4 py-3">
            <span className="text-sm text-[var(--st-text-tertiary)]">
              Showing {Math.min((currentPage - 1) * limit + 1, total)} to{' '}
              {Math.min(currentPage * limit, total)} of {total} entries
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                iconLeft={ChevronLeft}
                onClick={() => router.push(`?page=${currentPage - 1}`)}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <span className="px-2 text-sm text-[var(--st-text-secondary)]">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                iconRight={ChevronRight}
                onClick={() => router.push(`?page=${currentPage + 1}`)}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Generate AI content</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="AI model">
              <Select
                value={form.aiModel}
                onValueChange={(v: 'gpt-4' | 'claude') => setForm({ ...form, aiModel: v })}
              >
                <SelectTrigger aria-label="AI model">
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude">Claude</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Content type">
              <Select
                value={form.entityType}
                onValueChange={(v) => setForm({ ...form, entityType: v })}
              >
                <SelectTrigger aria-label="Content type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prompt">
              <Textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Write an engaging follow-up email for a recent real estate lead…"
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft={Bot} loading={isPending} onClick={handleCreate}>
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
