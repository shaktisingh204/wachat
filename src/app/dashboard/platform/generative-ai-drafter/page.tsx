'use client';

import { useEffect, useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Input, Label, Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogFooter, useZoruToast, ZoruSelect, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/zoruui';
import { getGenerativeAIDrafts, createGenerativeAIDraft, updateGenerativeAIDraftStatus, deleteGenerativeAIDraft } from '@/app/actions/platform/generative-ai-drafter.actions';
import type { GenerativeAIDraft } from '@/types/platform';
import { LoaderCircle, Plus, Trash2, CheckCircle, XCircle, Bot } from 'lucide-react';

export default function GenerativeAIDrafterPage() {
  const [data, setData] = useState<GenerativeAIDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const [form, setForm] = useState({ entityType: 'email', prompt: '' });

  const loadData = async () => {
    setLoading(true);
    const res = await getGenerativeAIDrafts();
    setData(res);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    if (!form.prompt) return;
    startTransition(async () => {
      try {
        // Mock generation
        const mockContent = `Generated ${form.entityType} content based on: "${form.prompt}". \n\nDear customer,\nWe are excited to share... [AI Generated Content]`;
        
        await createGenerativeAIDraft({
          ...form,
          content: mockContent,
          status: 'draft'
        });
        toast({ title: 'Draft generated', variant: 'success' });
        setDialogOpen(false);
        setForm({ entityType: 'email', prompt: '' });
        loadData();
      } catch (err) {
        toast({ title: 'Error generating draft', variant: 'destructive' });
      }
    });
  };

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateGenerativeAIDraftStatus(id, status);
      toast({ title: `Draft ${status}`, variant: 'success' });
      loadData();
    } catch (err) {
      toast({ title: 'Error updating draft', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteGenerativeAIDraft(id);
      toast({ title: 'Draft deleted', variant: 'success' });
      loadData();
    } catch (err) {
      toast({ title: 'Error deleting draft', variant: 'destructive' });
    }
  };

  const filteredData = data.filter(d => d.prompt.toLowerCase().includes(query.toLowerCase()) || d.entityType.includes(query.toLowerCase()));

  return (
    <EntityListShell
      title="Generative AI Drafter"
      subtitle="Draft emails, proposals, and contracts instantly using AI."
      primaryAction={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />New Draft</Button>}
      search={{ value: query, onChange: setQuery, placeholder: 'Search drafts...' }}
      loading={loading}
    >
      <div className="grid gap-6">
        {filteredData.map(item => (
          <Card key={item.id} className="p-6 flex flex-col md:flex-row gap-6 border-zoru-line">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <Bot className="w-5 h-5 text-zoru-accent" />
                <span className="font-semibold text-zoru-ink uppercase text-sm tracking-wider">{item.entityType}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${item.status === 'approved' ? 'bg-green-100 text-green-700' : item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'}`}>
                  {item.status}
                </span>
              </div>
              <p className="text-sm font-medium text-zoru-ink mb-2">Prompt: <span className="text-zoru-ink-light italic">"{item.prompt}"</span></p>
              <div className="bg-zoru-neutral-hover p-4 rounded-md text-sm text-zoru-ink mt-4 whitespace-pre-wrap font-mono">
                {item.content}
              </div>
            </div>
            <div className="flex flex-row md:flex-col items-center justify-end gap-2 md:w-32 border-t md:border-t-0 md:border-l border-zoru-line pt-4 md:pt-0 md:pl-4">
              {item.status === 'draft' && (
                <>
                  <Button variant="outline" className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleStatus(item.id, 'approved')}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Approve
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleStatus(item.id, 'rejected')}>
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                </>
              )}
              <Button variant="ghost" className="w-full justify-start text-zoru-ink-light hover:text-red-500" onClick={() => handleDelete(item.id)}>
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
              <Label>Content Type</Label>
              <ZoruSelect value={form.entityType} onValueChange={v => setForm({ ...form, entityType: v })}>
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
