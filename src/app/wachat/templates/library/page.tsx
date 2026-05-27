'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
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
  Star,
  Search,
  Sparkles,
  Filter,
  Type as TypeIcon,
  Image as ImageIcon,
  Video,
  FileText,
  Hand,
  Truck,
  Shield,
  Calendar,
  MessageCircleHeart,
  Megaphone,
  Layers,
  Languages as LanguagesIcon,
  Tag,
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
  MetricTile,
} from '@/components/wachat-ui';

import * as React from 'react';

/* ── use-case classification ───────────────────────────────────── */

interface UseCase {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  matches: RegExp;
}

const USE_CASES: UseCase[] = [
  { id: 'welcome',     label: 'Welcome',     icon: Hand,                matches: /\b(welcome|onboard|hello|hi|getting started)\b/i },
  { id: 'promo',       label: 'Promotional', icon: Megaphone,           matches: /\b(promo|offer|discount|sale|deal|coupon)\b/i },
  { id: 'shipping',    label: 'Shipping',    icon: Truck,               matches: /\b(ship|delivery|track|order|dispatch)\b/i },
  { id: 'otp',         label: 'OTP / Auth',  icon: Shield,              matches: /\b(otp|verification|code|verify|auth)\b/i },
  { id: 'appointment', label: 'Appointment', icon: Calendar,            matches: /\b(appoint|reminder|booking|schedule|reservation)\b/i },
  { id: 'feedback',    label: 'Feedback',    icon: MessageCircleHeart,  matches: /\b(feedback|review|survey|rate|satisfaction)\b/i },
];

function classifyUseCase(t: LibraryTemplate): string {
  const text = `${t.name} ${t.body ?? ''}`.toLowerCase();
  for (const uc of USE_CASES) if (uc.matches.test(text)) return uc.id;
  if (t.category === 'AUTHENTICATION') return 'otp';
  if (t.category === 'MARKETING') return 'promo';
  return 'other';
}

function headerFormat(t: LibraryTemplate): string {
  const hc = t.components?.find?.((c: any) => c?.type === 'HEADER');
  return (hc?.format ?? 'NONE').toUpperCase();
}

function buttonCount(t: LibraryTemplate): number {
  return (t.components?.find?.((c: any) => c?.type === 'BUTTONS')?.buttons ?? []).length;
}

function varCount(t: LibraryTemplate): number {
  return (t.body?.match(/{{\s*\d+\s*}}/g) ?? []).length;
}

function languageLabel(code?: string | null): string {
  if (!code) return '-';
  return code.toUpperCase().replace('_', '-');
}

/* ── Library tile ──────────────────────────────────────────────── */

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
  const buttons = template.components.find((c) => c.type === 'BUTTONS')?.buttons || [];

  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const baseRating = 4.5;
  const baseReviews = 12;
  const aggregateRating = userRating
    ? (baseRating * baseReviews + userRating) / (baseReviews + 1)
    : baseRating;
  const reviewCount = userRating ? baseReviews + 1 : baseReviews;

  const stagger = Math.min(0.03 * index, 0.4);

  const media =
    headerComponent?.format === 'IMAGE'
      ? 'image'
      : headerComponent?.format === 'VIDEO'
      ? 'video'
      : headerComponent?.format === 'DOCUMENT'
      ? 'doc'
      : undefined;

  const vc = varCount(template);
  const hf = headerFormat(template);
  const bc = buttonCount(template);

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: stagger, ease: EASE_OUT }}
      className="group flex flex-col gap-2.5"
    >
      <TemplatePreview
        name={template.name.replace(/_/g, ' ')}
        body={template.body}
        buttons={buttons.map((b: any) => b.text).filter(Boolean).slice(0, 3)}
        media={media as any}
        footer={
          <div className="space-y-1.5">
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
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 font-semibold uppercase tracking-[0.04em] text-zinc-600">
                <LanguagesIcon className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />
                {languageLabel(template.language)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 font-semibold uppercase tracking-[0.04em] text-zinc-600">
                {hf === 'IMAGE' ? <ImageIcon className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden /> :
                 hf === 'VIDEO' ? <Video className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden /> :
                 hf === 'DOCUMENT' ? <FileText className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden /> :
                 <TypeIcon className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />}
                {hf.toLowerCase()}
              </span>
              {vc > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold text-zinc-600">
                  {vc} var
                </span>
              )}
              {bc > 0 && (
                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold text-zinc-600">
                  {bc} btn
                </span>
              )}
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono font-semibold text-zinc-600">
                {template.body.length}c
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
        Add to my templates
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
  const [useCaseFilter, setUseCaseFilter] = useState<string>('ALL');
  const [languageFilter, setLanguageFilter] = useState<string>('ALL');
  const [headerFilter, setHeaderFilter] = useState<string>('ALL');
  const [cloneTarget, setCloneTarget] = useState<LibraryTemplate | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [groupBy, setGroupBy] = useState<'usecase' | 'category' | 'none'>('usecase');

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
  const languages = useMemo(
    () => ['ALL', ...Array.from(new Set(templates.map((t) => t.language).filter(Boolean) as string[]))],
    [templates],
  );
  const headerTypes = useMemo(
    () => ['ALL', ...Array.from(new Set(templates.map(headerFormat)))],
    [templates],
  );

  const filtered = useMemo(
    () =>
      templates.filter((t) => {
        const nameMatch =
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.body.toLowerCase().includes(search.toLowerCase());
        const catMatch = categoryFilter === 'ALL' || t.category === categoryFilter;
        const langMatch = languageFilter === 'ALL' || t.language === languageFilter;
        const headerMatch = headerFilter === 'ALL' || headerFormat(t) === headerFilter;
        const useCaseMatch = useCaseFilter === 'ALL' || classifyUseCase(t) === useCaseFilter;
        return nameMatch && catMatch && langMatch && headerMatch && useCaseMatch;
      }),
    [templates, search, categoryFilter, languageFilter, headerFilter, useCaseFilter],
  );

  // Stats
  const useCaseCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) {
      const uc = classifyUseCase(t);
      m.set(uc, (m.get(uc) ?? 0) + 1);
    }
    return m;
  }, [templates]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return m;
  }, [templates]);

  const languageCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) if (t.language) m.set(t.language, (m.get(t.language) ?? 0) + 1);
    return m;
  }, [templates]);

  const headerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) {
      const f = headerFormat(t);
      m.set(f, (m.get(f) ?? 0) + 1);
    }
    return m;
  }, [templates]);

  // Group templates for display
  const grouped = useMemo(() => {
    if (groupBy === 'none') {
      return [{ id: 'all', label: 'All templates', items: filtered }];
    }
    if (groupBy === 'category') {
      const map = new Map<string, LibraryTemplate[]>();
      for (const t of filtered) {
        const arr = map.get(t.category) ?? [];
        arr.push(t);
        map.set(t.category, arr);
      }
      return Array.from(map.entries()).map(([id, items]) => ({
        id,
        label: id.replace(/_/g, ' ').toLowerCase(),
        items,
      }));
    }
    // use case
    const map = new Map<string, LibraryTemplate[]>();
    for (const t of filtered) {
      const uc = classifyUseCase(t);
      const arr = map.get(uc) ?? [];
      arr.push(t);
      map.set(uc, arr);
    }
    const order = [...USE_CASES.map((u) => u.id), 'other'];
    return order
      .filter((id) => map.has(id))
      .map((id) => {
        const uc = USE_CASES.find((u) => u.id === id);
        return {
          id,
          label: uc?.label ?? 'Other',
          icon: uc?.icon ?? Tag,
          items: map.get(id)!,
        };
      });
  }, [filtered, groupBy]);

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

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('ALL');
    setUseCaseFilter('ALL');
    setLanguageFilter('ALL');
    setHeaderFilter('ALL');
  };

  const activeFilterCount =
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (useCaseFilter !== 'ALL' ? 1 : 0) +
    (languageFilter !== 'ALL' ? 1 : 0) +
    (headerFilter !== 'ALL' ? 1 : 0);

  return (
    <WaPage>
      <PageHeader
        title="Template library"
        description="Browse curated, pre-made WhatsApp templates organized by use case. Add to your project in one click."
        kicker="Wachat · library"
        backHref="/wachat/templates"
        eyebrowIcon={BookCopy}
      />

      {/* KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Total" value={String(templates.length)} icon={BookCopy} delay={0.02} />
        {USE_CASES.slice(0, 5).map((uc, i) => (
          <MetricTile
            key={uc.id}
            label={uc.label}
            value={String(useCaseCounts.get(uc.id) ?? 0)}
            icon={uc.icon}
            delay={0.04 + i * 0.03}
          />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Filter rail */}
        <aside className={`${railOpen ? 'block' : 'hidden lg:block'} space-y-3`}>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <header className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                <Filter className="h-3 w-3" strokeWidth={2.25} />
                Filters
              </span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[10.5px] font-semibold uppercase tracking-[0.04em]"
                  style={{ color: 'var(--mt-accent)' }}
                >
                  Clear ({activeFilterCount})
                </button>
              )}
            </header>

            <RailFacet
              title="Use case"
              value={useCaseFilter}
              onChange={setUseCaseFilter}
              items={[
                { value: 'ALL', label: 'All', count: templates.length },
                ...USE_CASES.map((uc) => ({
                  value: uc.id,
                  label: uc.label,
                  count: useCaseCounts.get(uc.id) ?? 0,
                  icon: uc.icon,
                })),
                ...(useCaseCounts.get('other') ? [{ value: 'other', label: 'Other', count: useCaseCounts.get('other')! }] : []),
              ]}
            />
            <RailFacet
              title="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              items={categories.map((c) => ({
                value: c,
                label: c === 'ALL' ? 'All' : c.replace(/_/g, ' ').toLowerCase(),
                count: c === 'ALL' ? templates.length : categoryCounts.get(c) ?? 0,
              }))}
            />
            <RailFacet
              title="Header type"
              value={headerFilter}
              onChange={setHeaderFilter}
              items={headerTypes.map((h) => ({
                value: h,
                label: h === 'ALL' ? 'All' : h.toLowerCase(),
                count: h === 'ALL' ? templates.length : headerCounts.get(h) ?? 0,
              }))}
            />
            {languages.length > 2 && (
              <RailFacet
                title="Language"
                value={languageFilter}
                onChange={setLanguageFilter}
                items={languages.map((l) => ({
                  value: l,
                  label: l === 'ALL' ? 'All' : languageLabel(l),
                  count: l === 'ALL' ? templates.length : languageCounts.get(l) ?? 0,
                }))}
              />
            )}
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 space-y-3">
          {/* Toolbar */}
          <m.div
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2.5"
          >
            <button
              type="button"
              onClick={() => setRailOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-950 active:scale-[0.97] lg:hidden"
            >
              <Filter className="h-3 w-3" strokeWidth={2.25} />
              Filters
            </button>

            <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400">
              <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                placeholder="Search by name or body"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-0 bg-transparent p-0 text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>

            <div className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5">
              {(['usecase', 'category', 'none'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors"
                  style={{
                    color: groupBy === g ? '#ffffff' : '#52525b',
                    background: groupBy === g ? 'var(--mt-accent)' : 'transparent',
                  }}
                >
                  {g === 'none' ? 'flat' : g === 'usecase' ? 'use case' : 'category'}
                </button>
              ))}
            </div>

            <span className="ml-auto text-[11.5px] tabular-nums text-zinc-500">
              {filtered.length} / {templates.length}
            </span>
          </m.div>

          {/* Body */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-80 animate-pulse rounded-xl border border-zinc-200 bg-white"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No templates found"
              description="Try adjusting your search or filters."
              action={
                <WaButton variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </WaButton>
              }
            />
          ) : (
            <div className="space-y-5">
              {grouped.map((g) => {
                const Icon = (g as any).icon as React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }> | undefined;
                return (
                  <section key={g.id} className="space-y-3">
                    {groupBy !== 'none' && (
                      <header className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <h3 className="inline-flex items-center gap-2 text-[12px] font-semibold capitalize tracking-tight text-zinc-900">
                          {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> : <Layers className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />}
                          {g.label}
                          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600">
                            {g.items.length}
                          </span>
                        </h3>
                      </header>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                      {g.items.map((template, index) => (
                        <LibraryTile
                          key={template.name + index}
                          template={template}
                          index={index}
                          onUse={setCloneTarget}
                          reduceMotion={reduceMotion}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

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

/* ── rail facet ───────────────────────────────────────────────── */

interface RailFacetItem {
  value: string;
  label: string;
  count: number;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}

function RailFacet({
  title,
  value,
  onChange,
  items,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  items: RailFacetItem[];
}) {
  return (
    <div className="border-b border-zinc-100 px-3 py-2.5 last:border-b-0">
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((it) => {
          const isActive = value === it.value;
          const Icon = it.icon;
          return (
            <li key={it.value}>
              <button
                type="button"
                onClick={() => onChange(it.value)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-[11.5px] transition-colors duration-100 hover:bg-zinc-50"
                style={isActive ? { background: 'var(--mt-accent-soft)' } : undefined}
              >
                <span
                  className={`inline-flex min-w-0 items-center gap-1.5 truncate capitalize ${isActive ? 'font-semibold' : 'text-zinc-700'}`}
                  style={isActive ? { color: 'var(--mt-accent)' } : undefined}
                >
                  {Icon && <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />}
                  <span className="truncate">{it.label}</span>
                </span>
                <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-600">
                  {it.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
