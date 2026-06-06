'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch, Plus } from 'lucide-react';
import {
  Button,
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
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Textarea,
  zoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  actionCreateEmailJourney,
  actionListEmailJourneys,
} from '@/app/actions/email/journeys.actions';
import type { EmailJourneyDoc } from '@/lib/rust-client/email-journeys';
import { JourneyList } from './journey-list';
import { JourneyTemplateGallery } from './journey-template-gallery';

export function JourneysClient() {
  const [journeys, setJourneys] = useState<EmailJourneyDoc[]>([]);
  const [loading, setLoading]   = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await actionListEmailJourneys({ limit: 100 });
    if (!r.ok) {
      zoruToast({ title: 'Failed to load journeys', description: r.error, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setJourneys(r.data.items);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="space-y-8">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <GitBranch className="h-6 w-6" /> Journeys
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Build behavioural &amp; lifecycle journeys with the visual canvas.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New journey
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">Your journeys</h2>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : journeys.length === 0 ? (
          <EmptyState
            icon={<GitBranch />}
            title="No journeys yet"
            description="Start from a prebuilt template below — or create a blank draft."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New journey</Button>}
          />
        ) : (
          <JourneyList journeys={journeys} onChanged={refresh} />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">Start from a template</h2>
        <JourneyTemplateGallery onCreated={refresh} />
      </section>

      <NewJourneyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
    </div>
  );
}

interface NewJourneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewJourneyDialog({ open, onOpenChange, onCreated }: NewJourneyDialogProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!name.trim()) {
      zoruToast({ title: 'Journey name is required', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const r = await actionCreateEmailJourney({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger: { kind: 'list_join', config: {} },
        nodes: [
          {
            id: 'trigger',
            type: 'trigger',
            position: { x: 0, y: 0 },
            data: { label: 'Trigger', trigger: { kind: 'list_join', config: {} } },
          },
        ],
        edges: [],
      });
      if (!r.ok) {
        zoruToast({ title: 'Create failed', description: r.error, variant: 'destructive' });
        return;
      }
      zoruToast({ title: 'Journey created as draft' });
      setName(''); setDescription('');
      onCreated();
      onOpenChange(false);
      router.push(`/dashboard/email/journeys/${r.data._id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>New journey</ZoruDialogTitle>
          <ZoruDialogDescription>Start a blank draft. Add steps from the canvas after.</ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="j-name">Name</Label>
            <Input id="j-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome series" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-desc">Description (optional)</Label>
            <Textarea id="j-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <ZoruDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending ? 'Saving…' : 'Create draft'}</Button>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
