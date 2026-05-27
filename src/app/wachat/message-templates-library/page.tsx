'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  CircleX,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getTemplates, saveLibraryTemplate } from '@/app/actions/template.actions';
import { premadeTemplates } from '@/lib/premade-templates';
import { useRouter } from 'next/navigation';

import {
  WaPage,
  PageHeader,
  WaButton,
  TemplatePreview,
  EmptyState,
  type StatusTone,
} from '@/components/wachat-ui';

import * as React from 'react';

const TONE_MAP: Record<string, StatusTone> = {
  UTILITY: 'sending',
  MARKETING: 'sent',
  AUTHENTICATION: 'queued',
};

type LibraryRow = {
  id: string;
  name: string;
  category: string;
  body: string;
};

export default function MessageTemplatesLibraryPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [projectTemplates, setProjectTemplates] = useState<any[]>([]);
  const [tab, setTab] = useState<'project' | 'premade'>('project');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cloneTarget, setCloneTarget] = useState<LibraryRow | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const tpls = await getTemplates(String(activeProject._id));
      setProjectTemplates(tpls ?? []);
    });
  }, [activeProject?._id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopy = async (text: string, id: string, name: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copied', description: `"${name}" copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClone = (t: LibraryRow) => {
    const params = new URLSearchParams();
    params.set('cloneName', t.name);
    params.set('cloneCategory', t.category);
    params.set('cloneBody', t.body);
    router.push(`/wachat/template-builder?${params.toString()}`);
  };

  const handlePublish = async (t: LibraryRow) => {
    setPublishingId(t.id);
    const formData = new FormData();
    formData.append('name', t.name);
    formData.append('category', t.category);
    formData.append('language', 'en_US');
    formData.append('body', t.body);

    const sourceTpl = projectTemplates.find((pt) => String(pt._id) === t.id);
    if (sourceTpl?.components) {
      formData.append('components', JSON.stringify(sourceTpl.components));
    } else {
      formData.append('components', JSON.stringify([]));
    }

    const res = await saveLibraryTemplate(null, formData);
    setPublishingId(null);
    if (res?.error) {
      toast({ title: 'Error publishing', description: res.error, variant: 'destructive' });
    } else {
      toast({
        title: 'Published',
        description: 'Template successfully published to the community library.',
      });
      load();
    }
  };

  const projectRows: LibraryRow[] = projectTemplates.map((t: any) => ({
    id: String(t._id),
    name: t.name,
    category: t.category || 'UTILITY',
    body:
      t.components?.find((c: any) => c.type === 'BODY')?.text || t.body || '-',
  }));

  const premadeRows: LibraryRow[] = premadeTemplates.map((t, i) => ({
    id: `pre-${i}`,
    name: t.name,
    category: t.category,
    body: t.body,
  }));

  const renderGrid = (rows: LibraryRow[]) => {
    if (isPending && rows.length === 0) {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-zinc-200 bg-white"
            />
          ))}
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={CircleX}
          title={
            tab === 'project'
              ? 'No templates in this project yet'
              : 'No premade templates available'
          }
          description={
            tab === 'project'
              ? 'Sync templates from Meta or create one to populate this list.'
              : 'Check back soon for more premade templates.'
          }
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((t, i) => (
          <m.div
            key={t.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: Math.min(i * 0.04, 0.5),
              ease: EASE_OUT,
            }}
            className="flex flex-col gap-3"
          >
            <TemplatePreview
              name={t.name.replace(/_/g, ' ')}
              body={t.body}
              status={TONE_MAP[t.category] || 'draft'}
            />
            <div className="flex flex-wrap items-center gap-2">
              <WaButton
                size="sm"
                variant="outline"
                onClick={() => handleCopy(t.body, t.id, t.name)}
                leftIcon={copiedId === t.id ? Check : Copy}
              >
                {copiedId === t.id ? 'Copied' : 'Copy'}
              </WaButton>
              <WaButton size="sm" onClick={() => setCloneTarget(t)}>
                Use template
              </WaButton>
              {tab === 'project' && (
                <WaButton
                  size="sm"
                  variant="outline"
                  onClick={() => handlePublish(t)}
                  disabled={publishingId === t.id}
                  leftIcon={publishingId === t.id ? Loader2 : Upload}
                >
                  {publishingId === t.id ? 'Publishing' : 'Publish'}
                </WaButton>
              )}
            </div>
          </m.div>
        ))}
      </div>
    );
  };

  return (
    <WaPage>
      <PageHeader
        title="Message templates library"
        description="Browse your project templates or the premade library. Copy or clone into your account."
        kicker="Wachat · message library"
        backHref="/wachat/templates"
        actions={
          tab === 'project' && (
            <WaButton
              variant="outline"
              size="sm"
              onClick={load}
              disabled={isPending}
              leftIcon={isPending ? Loader2 : RefreshCw}
            >
              Refresh
            </WaButton>
          )
        }
      />

      {/* Segmented toggle */}
      <div className="mb-6 inline-flex rounded-full border border-zinc-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setTab('project')}
          aria-pressed={tab === 'project'}
          className="relative rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97]"
          style={{
            color: tab === 'project' ? '#ffffff' : '#52525b',
            background: tab === 'project' ? 'var(--mt-accent)' : 'transparent',
          }}
        >
          Project templates ({projectTemplates.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('premade')}
          aria-pressed={tab === 'premade'}
          className="relative rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97]"
          style={{
            color: tab === 'premade' ? '#ffffff' : '#52525b',
            background: tab === 'premade' ? 'var(--mt-accent)' : 'transparent',
          }}
        >
          Premade library ({premadeTemplates.length})
        </button>
      </div>

      {tab === 'project' ? renderGrid(projectRows) : renderGrid(premadeRows)}

      <Dialog
        open={Boolean(cloneTarget)}
        onOpenChange={(open) => !open && setCloneTarget(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Clone template</ZoruDialogTitle>
            <ZoruDialogDescription>
              {cloneTarget
                ? `Use "${cloneTarget.name.replace(/_/g, ' ')}" as a starting point in ${
                    activeProject?.name || 'your project'
                  }. The body will be copied to your clipboard.`
                : ''}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setCloneTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (cloneTarget) handleClone(cloneTarget);
                setCloneTarget(null);
              }}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Open builder
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
