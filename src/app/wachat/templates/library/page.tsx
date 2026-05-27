'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  useZoruToast,
  cn,
} from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  BookCopy,
  ChevronDown,
  Star,
  Search,
  Sparkles,
} from 'lucide-react';

import { getLibraryTemplates } from '@/app/actions/template.actions';
import { type LibraryTemplate } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { useTemplateStore } from '../template-store';

import {
  WaPage,
  PageHeader,
  WaButton,
  TemplatePreview,
  EmptyState,
} from '@/components/wachat-ui';

import * as React from 'react';

/* ── Library tile (wraps TemplatePreview) ──────────────────────── */

function LibraryTile({
  template,
  index,
  onUse,
  reduceMotion,
}: {
  template: LibraryTemplate;
  index: number;
  onUse: (t: LibraryTemplate) => void;
  reduceMotion: boolean | null;
}) {
  const headerComponent = template.components.find((c) => c.type === 'HEADER');
  const footerComponent = template.components.find((c) => c.type === 'FOOTER');
  const buttons = template.components.find((c) => c.type === 'BUTTONS')?.buttons || [];

  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const baseRating = 4.5;
  const baseReviews = 12;
  const aggregateRating = userRating
    ? (baseRating * baseReviews + userRating) / (baseReviews + 1)
    : baseRating;
  const reviewCount = userRating ? baseReviews + 1 : baseReviews;

  const stagger = Math.min(0.04 * index, 0.5);

  const media =
    headerComponent?.format === 'IMAGE'
      ? 'image'
      : headerComponent?.format === 'VIDEO'
      ? 'video'
      : headerComponent?.format === 'DOCUMENT'
      ? 'doc'
      : undefined;

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: stagger, ease: EASE_OUT }}
      className="group flex flex-col gap-3"
    >
      <TemplatePreview
        name={template.name.replace(/_/g, ' ')}
        body={template.body}
        buttons={buttons.map((b: any) => b.text).filter(Boolean).slice(0, 3)}
        media={media as any}
        footer={
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-[0.04em] text-zinc-500">
              {template.category.replace(/_/g, ' ').toLowerCase()}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = hoverRating
                    ? star <= hoverRating
                    : star <= Math.round(aggregateRating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setUserRating(star)}
                      className="focus:outline-none"
                      aria-label={`Rate ${star} stars`}
                    >
                      <Star
                        className={cn(
                          'h-3 w-3 transition-colors',
                          active ? 'fill-amber-400 text-amber-400' : 'text-zinc-300',
                        )}
                        strokeWidth={2}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="tabular-nums text-zinc-500">
                {aggregateRating.toFixed(1)} ({reviewCount})
              </span>
            </div>
          </div>
        }
      />
      <WaButton
        onClick={() => onUse(template)}
        rightIcon={BookCopy}
        size="sm"
        className="w-full"
      >
        Use this template
      </WaButton>
    </m.div>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function TemplateLibraryPage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();

  const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [cloneTarget, setCloneTarget] = useState<LibraryTemplate | null>(null);

  const setTemplateToAction = useTemplateStore((s) => s.setTemplateToAction);

  useEffect(() => {
    startLoading(async () => {
      const data = await getLibraryTemplates();
      setTemplates(data);
    });
  }, []);

  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(templates.map((t) => t.category)))],
    [templates],
  );

  const filtered = useMemo(
    () =>
      templates.filter((t) => {
        const nameMatch = t.name.toLowerCase().includes(search.toLowerCase());
        const catMatch = categoryFilter === 'ALL' || t.category === categoryFilter;
        return nameMatch && catMatch;
      }),
    [templates, search, categoryFilter],
  );

  const onConfirmClone = () => {
    if (!cloneTarget) return;
    setTemplateToAction(cloneTarget);
    toast({
      title: 'Template cloned',
      description: `Opening "${cloneTarget.name}" in the builder.`,
    });
    setCloneTarget(null);
    router.push('/wachat/templates/create?action=clone');
  };

  return (
    <WaPage>
      <PageHeader
        title="Template library"
        description="Browse pre-made, high-quality templates to get started quickly."
        kicker="Wachat · library"
        backHref="/wachat/templates"
        eyebrowIcon={BookCopy}
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400 sm:w-64">
              <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                placeholder="Search templates"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 bg-transparent p-0 text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-950 active:scale-[0.97]"
                >
                  {categoryFilter === 'ALL'
                    ? 'All categories'
                    : categoryFilter.replace(/_/g, ' ').toLowerCase()}
                  <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.25} />
                </button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Category</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuRadioGroup
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  {categories.map((c) => (
                    <ZoruDropdownMenuRadioItem key={c} value={c} className="capitalize">
                      {c === 'ALL' ? 'All' : c.replace(/_/g, ' ').toLowerCase()}
                    </ZoruDropdownMenuRadioItem>
                  ))}
                </ZoruDropdownMenuRadioGroup>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-white"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No templates found"
          description="Try adjusting your search or category filter."
          action={
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
              }}
            >
              Clear filters
            </WaButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((template, index) => (
            <LibraryTile
              key={template.name + index}
              template={template}
              index={index}
              onUse={setCloneTarget}
              reduceMotion={reduceMotion}
            />
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(cloneTarget)}
        onOpenChange={(open) => !open && setCloneTarget(null)}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Clone to your account</ZoruDialogTitle>
            <ZoruDialogDescription>
              {cloneTarget
                ? `Clone "${cloneTarget.name.replace(/_/g, ' ')}" into ${
                    activeProject?.name || 'your project'
                  }. You will be taken to the builder to review and submit.`
                : ''}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setCloneTarget(null)}>
              Cancel
            </Button>
            <Button onClick={onConfirmClone}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Clone and open
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
