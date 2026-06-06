'use client';

import { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, useToast, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui';
import { createGenerativeAIDraft, updateGenerativeAIDraftStatus, deleteGenerativeAIDraft } from '@/app/actions/platform/generative-ai-drafter.actions';
import type { GenerativeAIDraft } from '@/types/platform';
import { LoaderCircle, Plus, Trash2, CheckCircle, XCircle, Bot, Cpu, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GenerativeAIDrafterClientPage({ 
  initialData, 
  total,
  currentPage,
  limit
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
    prompt: '' 
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
          status: 'draft'
        });
        toast({ title: 'Draft generated', variant: 'success' });
        setDialogOpen(false);
        setForm({ entityType: 'email', aiModel: 'gpt-4', prompt: '' });
        router.refresh();
      } catch (err) {
        toast({ title: 'Error generating draft', variant: 'destructive' });
      }
    });
  };

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateGenerativeAIDraftStatus(id, status);
      toast({ title: `Draft ${status}`, variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: 'Error updating draft', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteGenerativeAIDraft(id);
      toast({ title: 'Draft deleted', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: 'Error deleting draft', variant: 'destructive' });
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
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />New Draft</Button>}
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
                onClick={() => router.push(`?page=${currentPage - 1}`)} 
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm px-2">Page {currentPage} of {totalPages}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => router.push(`?page=${currentPage + 1}`)} 
                disabled={currentPage >= totalPages}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      <div className="grid gap-6">
        {filteredData.map(item => (
          <Card key={item.id} className="p-6 flex flex-col md:flex-row gap-6 border-[var(--st-border)]">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <Bot className="w-5 h-5 text-[var(--st-accent)]" />
                <span className="font-semibold text-[var(--st-text)] uppercase text-sm tracking-wider">{item.entityType}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${item.status === 'approved' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : item.status === 'rejected' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'}`}>
                  {item.status}
                </span>
                {item.aiModel && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] ml-2 inline-flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    {item.aiModel === 'gpt-4' ? 'GPT-4' : 'Claude'}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-[var(--st-text)] mb-2">Prompt: <span className="text-[var(--st-text-tertiary)] italic">"{item.prompt}"</span></p>
              <div className="bg-[var(--st-hover)] p-4 rounded-md text-sm text-[var(--st-text)] mt-4 whitespace-pre-wrap font-mono">
                {item.content}
              </div>
            </div>
            <div className="flex flex-row md:flex-col items-center justify-end gap-2 md:w-32 border-t md:border-t-0 md:border-l border-[var(--st-border)] pt-4 md:pt-0 md:pl-4">
              {item.status === 'draft' && (
                <>
                  <Button variant="outline" className="w-full justify-start text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]" onClick={() => handleStatus(item.id, 'approved')}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Approve
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]" onClick={() => handleStatus(item.id, 'rejected')}>
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                </>
              )}
              <Button variant="ghost" className="w-full justify-start text-[var(--st-text-tertiary)] hover:text-[var(--st-text)]" onClick={() => handleDelete(item.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          </Card>
        ))}
        {filteredData.length === 0 && (
          <div className="py-12 text-center text-[var(--st-text-tertiary)]">No drafts found.</div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Generate AI Content</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>AI Model</Label>
              <Select value={form.aiModel} onValueChange={(v: 'gpt-4' | 'claude') => setForm({ ...form, aiModel: v })}>
                <SelectTrigger><SelectValue placeholder="Select AI Model" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="claude">Claude</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Content Type</Label>
              <Select value={form.entityType} onValueChange={(v) => setForm({ ...form, entityType: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Prompt</Label>
              <Input 
                value={form.prompt} 
                onChange={e => setForm({ ...form, prompt: e.target.value })} 
                placeholder="Write an engaging follow-up email for a recent real estate lead..." 
                className="h-20 items-start"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}

