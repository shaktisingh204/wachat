'use client';

import { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, useZoruToast, ZoruSelect, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/zoruui';
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
  const { toast } = useZoruToast();
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
          <div className="flex items-center justify-between border-t border-zoru-line pt-4 mt-4">
            <span className="text-sm text-zoru-ink-light">
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
          <Card key={item.id} className="p-6 flex flex-col md:flex-row gap-6 border-zoru-line">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <Bot className="w-5 h-5 text-zoru-accent" />
                <span className="font-semibold text-zoru-ink uppercase text-sm tracking-wider">{item.entityType}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${item.status === 'approved' ? 'bg-zoru-surface-2 text-zoru-ink' : item.status === 'rejected' ? 'bg-zoru-surface-2 text-zoru-ink' : 'bg-zoru-surface-2 text-zoru-ink'}`}>
                  {item.status}
                </span>
                {item.aiModel && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-zoru-surface-2 text-zoru-ink ml-2 inline-flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    {item.aiModel === 'gpt-4' ? 'GPT-4' : 'Claude'}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-zoru-ink mb-2">Prompt: <span className="text-zoru-ink-light italic">"{item.prompt}"</span></p>
              <div className="bg-zoru-neutral-hover p-4 rounded-md text-sm text-zoru-ink mt-4 whitespace-pre-wrap font-mono">
                {item.content}
              </div>
            </div>
            <div className="flex flex-row md:flex-col items-center justify-end gap-2 md:w-32 border-t md:border-t-0 md:border-l border-zoru-line pt-4 md:pt-0 md:pl-4">
              {item.status === 'draft' && (
                <>
                  <Button variant="outline" className="w-full justify-start text-zoru-ink hover:text-zoru-ink hover:bg-zoru-surface-2" onClick={() => handleStatus(item.id, 'approved')}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Approve
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-zoru-ink hover:text-zoru-ink hover:bg-zoru-surface-2" onClick={() => handleStatus(item.id, 'rejected')}>
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                </>
              )}
              <Button variant="ghost" className="w-full justify-start text-zoru-ink-light hover:text-zoru-ink" onClick={() => handleDelete(item.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </div>
          </Card>
        ))}
        {filteredData.length === 0 && (
          <div className="py-12 text-center text-zoru-ink-light">No drafts found.</div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Generate AI Content</ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>AI Model</Label>
              <ZoruSelect value={form.aiModel} onValueChange={(v: 'gpt-4' | 'claude') => setForm({ ...form, aiModel: v })}>
                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select AI Model" /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="gpt-4">GPT-4</ZoruSelectItem>
                  <ZoruSelectItem value="claude">Claude</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="grid gap-2">
              <Label>Content Type</Label>
              <ZoruSelect value={form.entityType} onValueChange={(v) => setForm({ ...form, entityType: v })}>
                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select type" /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="email">Email</ZoruSelectItem>
                  <ZoruSelectItem value="proposal">Proposal</ZoruSelectItem>
                  <ZoruSelectItem value="contract">Contract</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
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
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />} Generate
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </EntityListShell>
  );
}

