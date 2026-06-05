'use client';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Modal,
  SegmentedControl,
  Skeleton,
  useToast,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
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
  RefreshCw,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getTemplates, saveLibraryTemplate } from '@/app/actions/template.actions';
import { premadeTemplates } from '@/lib/premade-templates';
import { useRouter } from 'next/navigation';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Message Templates Library — browse project templates +
 * premade library, rebuilt on the 20ui design system.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const TONE_MAP: Record<string, BadgeTone> = {
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
  const { toast } = useToast();
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
      tone: 'success',
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
        tone: 'danger',
      });
    } else {
      toast({
        title: 'Published',
        description: 'Template successfully published to the community library.',
        tone: 'success',
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
            <Skeleton key={i} height={176} className="w-full" />
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((t) => (
          <Card key={t.id} variant="elevated" padding="none" className="flex flex-col">
            <CardBody className="flex flex-1 flex-col gap-2">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3
                  className="text-[14px] font-semibold capitalize"
                  style={{ color: 'var(--st-text)' }}
                >
                  {t.name.replace(/_/g, ' ')}
                </h3>
                <Badge tone={TONE_MAP[t.category] || 'neutral'} className="capitalize">
                  {t.category.toLowerCase()}
                </Badge>
              </div>
              <p
                className="line-clamp-3 flex-1 text-[12.5px] leading-relaxed"
                style={{ color: 'var(--st-text-secondary)' }}
              >
                {t.body}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  iconLeft={copiedId === t.id ? Check : Copy}
                  onClick={() => handleCopy(t.body, t.id, t.name)}
                >
                  {copiedId === t.id ? 'Copied!' : 'Copy'}
                </Button>
                <Button size="sm" variant="primary" onClick={() => setCloneTarget(t)}>
                  Use template
                </Button>
                {tab === 'project' && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={publishingId === t.id}
                    onClick={() => handlePublish(t)}
                    disabled={publishingId === t.id}
                  >
                    Publish
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Templates', href: '/wachat/templates' },
        { label: 'Message library' },
      ]}
      title="Message templates library"
      description="Browse your project templates or the premade library. Click to copy or clone into your account."
      width="wide"
      actions={
        tab === 'project' ? (
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            loading={isPending}
            onClick={load}
            disabled={isPending}
          >
            Refresh
          </Button>
        ) : undefined
      }
    >
      {/* Segmented toggle — switches between project + premade. */}
      <div className="flex">
        <SegmentedControl
          aria-label="Template source"
          value={tab}
          onChange={(v) => setTab(v as 'project' | 'premade')}
          items={[
            { value: 'project', label: `Project templates (${projectTemplates.length})` },
            { value: 'premade', label: `Premade library (${premadeTemplates.length})` },
          ]}
        />
      </div>

      <div className="mt-4">
        {tab === 'project' ? renderGrid(projectRows) : renderGrid(premadeRows)}
      </div>

      {/* Clone-to-account dialog */}
      <Modal
        open={Boolean(cloneTarget)}
        onClose={() => setCloneTarget(null)}
        title="Clone template"
        description={
          cloneTarget
            ? `Use "${cloneTarget.name.replace(/_/g, ' ')}" as a starting point in ${
                activeProject?.name || 'your project'
              }. The body will be copied to your clipboard.`
            : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloneTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (cloneTarget) {
                  handleClone(cloneTarget);
                }
                setCloneTarget(null);
              }}
            >
              Open Builder
            </Button>
          </>
        }
      />
    </WachatPage>
  );
}
