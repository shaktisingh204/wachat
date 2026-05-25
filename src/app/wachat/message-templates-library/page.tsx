'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  useZoruToast,
  type ZoruBadgeProps,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  } from 'react';
import {
  CircleX,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getTemplates, saveLibraryTemplate } from '@/app/actions/template.actions';
import { premadeTemplates } from '@/lib/premade-templates';
import { useRouter } from 'next/navigation';

/**
 * Wachat Message Templates Library — browse project templates +
 * premade library, rebuilt on ZoruUI primitives.
 */

import * as React from 'react';

const TONE_MAP: Record<string, ZoruBadgeProps['variant']> = {
  UTILITY: 'info',
  MARKETING: 'success',
  AUTHENTICATION: 'warning',
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
    toast({
      title: 'Copied',
      description: `"${name}" copied to clipboard.`,
    });
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
      toast({
        title: 'Error publishing',
        description: res.error,
        variant: 'destructive',
      });
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
      t.components?.find((c: any) => c.type === 'BODY')?.text ||
      t.body ||
      '—',
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          icon={<CircleX />}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((t) => (
          <Card
            key={t.id}
            variant="elevated"
            className="flex flex-col"
          >
            <ZoruCardContent className="flex flex-1 flex-col gap-2 pt-6">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="text-[14px] font-semibold capitalize text-zoru-ink">
                  {t.name.replace(/_/g, ' ')}
                </h3>
                <Badge
                  variant={TONE_MAP[t.category] || 'secondary'}
                  className="capitalize"
                >
                  {t.category.toLowerCase()}
                </Badge>
              </div>
              <p className="line-clamp-3 flex-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                {t.body}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(t.body, t.id, t.name)}
                >
                  {copiedId === t.id ? <Check /> : <Copy />}
                  {copiedId === t.id ? 'Copied!' : 'Copy'}
                </Button>
                <Button size="sm" onClick={() => setCloneTarget(t)}>
                  Use template
                </Button>
                {tab === 'project' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePublish(t)}
                    disabled={publishingId === t.id}
                  >
                    {publishingId === t.id ? (
                      <Loader2 className="animate-spin mr-1 h-4 w-4" />
                    ) : null}
                    Publish
                  </Button>
                )}
              </div>
            </ZoruCardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/templates">
              Templates
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Message library</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>Message templates library</ZoruPageTitle>
          <ZoruPageDescription>
            Browse your project templates or the premade library. Click to copy
            or clone into your account.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          {tab === 'project' && (
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Refresh
            </Button>
          )}
        </ZoruPageActions>
      </PageHeader>

      {/* Segmented toggle (no tabs) — switches between project + premade. */}
      <div className="inline-flex rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1">
        <button
          type="button"
          onClick={() => setTab('project')}
          aria-pressed={tab === 'project'}
          className={`inline-flex items-center gap-2 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors ${
            tab === 'project'
              ? 'bg-zoru-surface-2 text-zoru-ink'
              : 'text-zoru-ink-muted hover:text-zoru-ink'
          }`}
        >
          Project templates ({projectTemplates.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('premade')}
          aria-pressed={tab === 'premade'}
          className={`inline-flex items-center gap-2 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors ${
            tab === 'premade'
              ? 'bg-zoru-surface-2 text-zoru-ink'
              : 'text-zoru-ink-muted hover:text-zoru-ink'
          }`}
        >
          Premade library ({premadeTemplates.length})
        </button>
      </div>

      <div className="mt-4">
        {tab === 'project' ? renderGrid(projectRows) : renderGrid(premadeRows)}
      </div>

      {/* Clone-to-account dialog */}
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
            <Button
              variant="ghost"
              onClick={() => setCloneTarget(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (cloneTarget) {
                  handleClone(cloneTarget);
                }
                setCloneTarget(null);
              }}
            >
              Open Builder
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <div className="h-6" />
    </div>
  );
}
