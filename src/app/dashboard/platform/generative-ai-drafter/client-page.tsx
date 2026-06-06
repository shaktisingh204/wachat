'use client';

import { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Badge,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  useToast,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { createGenerativeAIDraft, updateGenerativeAIDraftStatus, deleteGenerativeAIDraft } from '@/app/actions/platform/generative-ai-drafter.actions';
import type { GenerativeAIDraft } from '@/types/platform';
import { Plus, Trash2, CheckCircle, XCircle, Bot, Cpu, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

const STATUS_TONE: Record<string, 'success' | 'danger' | 'neutral'> = {
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
  initialData: GenerativeAIDraft[],
  total: number,
  currentPage: number,
  limit: number
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const [form, setForm] = useState<{ entityType: string, aiModel: 'gpt-4' | 'claude', prompt: string }>({
    entityType: 'email',
    aiModel: 'gpt-4',
    prompt: '',
  });

  const handleCreate = async () => {
    if (!form.prompt) return;
    startTransition(async () => {
      try {
        // Mock generation
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
      } catch (err) {
        toast.error('Error generating draft');
      }
    });
  };

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateGenerativeAIDraftStatus(id, status);
      toast.success(`Draft ${status}`);
      router.refresh();
    } catch (err) {
      toast.error('Error updating draft');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteGenerativeAIDraft(id);
      toast.success('Draft deleted');
      router.refresh();
    } catch (err) {
      toast.error('Error deleting draft');
    }
  };

  const filteredData = initialData.filter(d =>
    d.prompt.toLowerCase().includes(query.toLowerCase()) ||
    d.entityType.includes(query.toLowerCase()) ||
    (d.aiModel && d.aiModel.toLowerCase().includes(query.toLowerCase()))
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <EntityListShell
      title="Generative AI Drafter"
      subtitle="Draft emails, proposals, and contracts instantly using AI."
      primaryAction={<Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>New Draft</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search drafts...' }}
      pagination={
        totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[var(--st-border)] pt-4 mt-4">
            <span className="text-sm text-[var(--st-text-tertiary)]">
              Showing {Math.min((currentPage - 1) * limit + 1, total)} to {Math.min(currentPage * limit, total)} of {total} entries
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
              <span className="text-sm px-2 text-[var(--st-text-secondary)]">Page {currentPage} of {totalPages}</span>
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
        ) : null
      }
    >
      <div className="grid gap-6">
        {filteredData.map(item => (
          <Card key={item.id} variant="outlined" padding="lg" className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Bot className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                <span className="font-semibold text-[var(--st-text)] uppercase text-sm tracking-wider">{item.entityType}</span>
                <Badge tone={STATUS_TONE[item.status] ?? 'neutral'}>{item.status}</Badge>
                {item.aiModel && (
                  <Badge tone="info" className="inline-flex items-center gap-1">
                    <Cpu className="w-3 h-3" aria-hidden="true" />
                    {item.aiModel === 'gpt-4' ? 'GPT-4' : 'Claude'}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-[var(--st-text)] mb-2">
                Prompt: <span className="text-[var(--st-text-tertiary)] italic">"{item.prompt}"</span>
              </p>
              <div className="bg-[var(--st-bg-secondary)] p-4 rounded-[var(--st-radius)] text-sm text-[var(--st-text)] mt-4 whitespace-pre-wrap font-mono">
                {item.content}
              </div>
            </div>
            <div className="flex flex-row md:flex-col items-center justify-end gap-2 md:w-32 border-t md:border-t-0 md:border-l border-[var(--st-border)] pt-4 md:pt-0 md:pl-4">
              {item.status === 'draft' && (
                <>
                  <Button variant="outline" block iconLeft={CheckCircle} className="justify-start" onClick={() => handleStatus(item.id, 'approved')}>
                    Approve
                  </Button>
                  <Button variant="outline" block iconLeft={XCircle} className="justify-start" onClick={() => handleStatus(item.id, 'rejected')}>
                    Reject
                  </Button>
                </>
              )}
              <Button variant="ghost" block iconLeft={Trash2} className="justify-start" onClick={() => handleDelete(item.id)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {filteredData.length === 0 && (
          <EmptyState
            icon={Bot}
            title="No drafts found"
            description="Generate your first AI draft to see it here."
            action={<Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>New Draft</Button>}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Generate AI Content</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="AI Model">
              <Select value={form.aiModel} onValueChange={(v: 'gpt-4' | 'claude') => setForm({ ...form, aiModel: v })}>
                <SelectTrigger aria-label="AI Model"><SelectValue placeholder="Select AI Model" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude">Claude</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Content Type">
              <Select value={form.entityType} onValueChange={(v) => setForm({ ...form, entityType: v })}>
                <SelectTrigger aria-label="Content Type"><SelectValue placeholder="Select type" /></SelectTrigger>
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
                onChange={e => setForm({ ...form, prompt: e.target.value })}
                placeholder="Write an engaging follow-up email for a recent real estate lead..."
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" iconLeft={Bot} loading={isPending} onClick={handleCreate}>
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
