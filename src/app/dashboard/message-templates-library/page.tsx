'use client';

/**
 * Wachat Message Templates Library — browse project templates + premade library.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuCircleCheck, LuCircleX, LuTriangleAlert, LuCopy, LuCheck, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getTemplates } from '@/app/actions/template.actions';
import { premadeTemplates } from '@/lib/premade-templates';

const TONE_MAP: Record<string, 'green' | 'blue' | 'amber' | 'neutral'> = {
  UTILITY: 'blue', MARKETING: 'green', AUTHENTICATION: 'amber',
};

export default function MessageTemplatesLibraryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [projectTemplates, setProjectTemplates] = useState<any[]>([]);
  const [tab, setTab] = useState<'project' | 'premade'>('project');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const tpls = await getTemplates(String(activeProject._id));
      setProjectTemplates(tpls ?? []);
    });
  }, [activeProject?._id]);

  useEffect(() => { load(); }, [load]);

  const handleCopy = async (text: string, id: string, name: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copied', description: `"${name}" copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const templates = tab === 'project'
    ? projectTemplates.map((t: any) => ({ id: t._id, name: t.name, category: t.category || 'UTILITY', body: t.components?.find((c: any) => c.type === 'BODY')?.text || t.body || '--' }))
    : premadeTemplates.map((t, i) => ({ id: `pre-${i}`, name: t.name, category: t.category, body: t.body }));

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Template Library' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Message Templates Library</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Browse your project templates or the premade library. Click to copy.</p>
      </div>

      <div className="flex gap-2">
        <ClayButton variant={tab === 'project' ? 'obsidian' : 'pill'} size="sm" onClick={() => setTab('project')}>
          Project Templates ({projectTemplates.length})
        </ClayButton>
        <ClayButton variant={tab === 'premade' ? 'obsidian' : 'pill'} size="sm" onClick={() => setTab('premade')}>
          Premade Library ({premadeTemplates.length})
        </ClayButton>
        {tab === 'project' && (
          <ClayButton variant="pill" size="sm" onClick={load} disabled={isPending} className="ml-auto">
            {isPending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
          </ClayButton>
        )}
      </div>

      {isPending && templates.length === 0 ? (
        <div className="flex h-40 items-center justify-center gap-3">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
        </div>
      ) : templates.length === 0 ? (
        <ClayCard className="p-12 text-center">
          <LuCircleX className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">{tab === 'project' ? 'No templates in this project yet.' : 'No premade templates available.'}</p>
        </ClayCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <ClayCard key={t.id} padded={false} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-[15px] font-semibold text-clay-ink">{t.name.replace(/_/g, ' ')}</h3>
                <ClayBadge tone={TONE_MAP[t.category] || 'neutral'}>{t.category}</ClayBadge>
              </div>
              <p className="flex-1 text-[12.5px] text-clay-ink-muted leading-relaxed line-clamp-3">{t.body}</p>
              <div className="mt-4">
                <ClayButton size="sm" variant="pill" onClick={() => handleCopy(t.body, t.id, t.name)}
                  leading={copiedId === t.id ? <LuCheck className="h-3.5 w-3.5 text-emerald-600" /> : <LuCopy className="h-3.5 w-3.5" />}>
                  {copiedId === t.id ? 'Copied!' : 'Use Template'}
                </ClayButton>
              </div>
            </ClayCard>
          ))}
        </div>
      )}
      <div className="h-6" />
    </div>
  );
}
