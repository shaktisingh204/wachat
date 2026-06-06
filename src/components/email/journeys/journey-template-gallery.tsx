'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Badge, Button, Card, Skeleton, toast } from '@/components/sabcrm/20ui';
import {
  actionCreateEmailJourney,
  actionListEmailJourneyTemplates,
} from '@/app/actions/email/journeys.actions';
import type { EmailJourneyTemplate } from '@/lib/rust-client/email-journeys';

export function JourneyTemplateGallery({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailJourneyTemplate[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await actionListEmailJourneyTemplates();
      if (cancelled) return;
      if (!r.ok) {
        toast({ title: 'Failed to load templates', description: r.error, variant: 'destructive' });
        setTemplates([]);
        return;
      }
      setTemplates(r.data);
    })();
    return () => { cancelled = true; };
  }, []);

  const useTemplate = (tpl: EmailJourneyTemplate) => {
    startTransition(async () => {
      const r = await actionCreateEmailJourney({
        name: tpl.name,
        description: tpl.description,
        nodes: tpl.nodes,
        edges: tpl.edges,
        trigger: tpl.trigger,
      });
      if (!r.ok) {
        toast({ title: 'Could not create from template', description: r.error, variant: 'destructive' });
        return;
      }
      toast({ title: `Journey "${r.data.name}" created from template` });
      onCreated?.();
      router.push(`/dashboard/email/journeys/${r.data._id}`);
    });
  };

  if (templates === null) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-[var(--st-text-secondary)]">No prebuilt templates available.</p>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((tpl) => (
        <Card key={tpl.id} className="p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 mt-0.5 text-[var(--st-text-secondary)]" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{tpl.name}</p>
              <Badge variant="outline" className="mt-1">{tpl.category}</Badge>
            </div>
          </div>
          <p className="text-xs text-[var(--st-text-secondary)] line-clamp-3 flex-1">{tpl.description}</p>
          <Button size="sm" disabled={pending} onClick={() => useTemplate(tpl)}>
            {pending ? 'Creating…' : 'Use template'}
          </Button>
        </Card>
      ))}
    </div>
  );
}
