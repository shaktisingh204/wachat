'use client';

/**
 * Wachat Template Library — premade templates grid, rebuilt on
 * ZoruUI primitives. Click a template to open clone-to-account dialog.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  BookCopy,
  ChevronLeft,
  Image as ImageIcon,
  Phone,
  Link as LinkIcon,
  Star,
  Search,
} from 'lucide-react';

import { getLibraryTemplates } from '@/app/actions/template.actions';
import { type LibraryTemplate } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruBadge,
  useZoruToast,
} from '@/components/zoruui';

/* ── Preview tile ──────────────────────────────── */

function TemplateTile({
  template,
  onUse,
}: {
  template: LibraryTemplate;
  onUse: (t: LibraryTemplate) => void;
}) {
  const headerComponent = template.components.find((c) => c.type === 'HEADER');
  const footerComponent = template.components.find((c) => c.type === 'FOOTER');
  const buttons =
    template.components.find((c) => c.type === 'BUTTONS')?.buttons || [];

  const renderTextWithVariables = (text: string) => {
    if (!text) return null;
    const parts = text.split(/({{\d+}})/g);
    return parts.map((part, i) =>
      part.match(/{{\d+}}/) ? (
        <span key={i} className="font-bold text-zoru-ink">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const getButtonIcon = (type: string) => {
    switch (type) {
      case 'URL':
        return <LinkIcon className="mr-2 h-4 w-4" />;
      case 'PHONE_NUMBER':
        return <Phone className="mr-2 h-4 w-4" />;
      case 'QUICK_REPLY':
        return <Star className="mr-2 h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <ZoruCard variant="elevated" className="flex flex-col">
      <ZoruCardContent className="flex flex-1 flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[14px] font-semibold capitalize text-zoru-ink">
            {template.name.replace(/_/g, ' ')}
          </h3>
          <ZoruBadge variant="secondary" className="capitalize">
            {template.category.replace(/_/g, ' ').toLowerCase()}
          </ZoruBadge>
        </div>

        <p className="text-[12px] text-zoru-ink-muted">
          A pre-built template for{' '}
          {template.category.replace(/_/g, ' ').toLowerCase()} use cases.
        </p>

        <div className="flex-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
          <div className="mx-auto w-full max-w-xs">
            <div className="space-y-2 rounded-[var(--zoru-radius)] bg-zoru-bg p-3 text-sm text-zoru-ink shadow-[var(--zoru-shadow-sm)]">
              {headerComponent &&
                (headerComponent.format === 'IMAGE' ||
                  headerComponent.format === 'VIDEO' ||
                  headerComponent.format === 'DOCUMENT') && (
                  <div className="mb-2 flex aspect-video items-center justify-center rounded-md bg-zoru-surface-2">
                    <ImageIcon className="h-10 w-10 text-zoru-ink-subtle" />
                  </div>
                )}
              {headerComponent && headerComponent.format === 'TEXT' && (
                <h3 className="mb-1 text-base font-bold text-zoru-ink">
                  {headerComponent.text}
                </h3>
              )}
              <p className="whitespace-pre-wrap">
                {renderTextWithVariables(template.body)}
              </p>
              {footerComponent && (
                <p className="pt-1 text-xs text-zoru-ink-muted">
                  {footerComponent.text}
                </p>
              )}
            </div>
            {buttons.length > 0 && (
              <div className="mt-2 space-y-1">
                {buttons.map((button: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-center rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-2 text-center text-sm font-medium text-zoru-ink shadow-[var(--zoru-shadow-sm)]"
                  >
                    {getButtonIcon(button.type)}
                    {button.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <ZoruButton
          className="mt-auto w-full"
          onClick={() => onUse(template)}
        >
          Use this template
        </ZoruButton>
      </ZoruCardContent>
    </ZoruCard>
  );
}

/* ── Page ──────────────────────────────────────── */

export default function TemplateLibraryPage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [cloneTarget, setCloneTarget] = useState<LibraryTemplate | null>(null);

  useEffect(() => {
    startLoading(async () => {
      const data = await getLibraryTemplates();
      setTemplates(data);
    });
  }, []);

  const categories = useMemo(
    () => [
      'ALL',
      ...Array.from(new Set(templates.map((t) => t.category))),
    ],
    [templates],
  );

  const filtered = useMemo(
    () =>
      templates.filter((t) => {
        const nameMatch = t.name.toLowerCase().includes(search.toLowerCase());
        const catMatch =
          categoryFilter === 'ALL' || t.category === categoryFilter;
        return nameMatch && catMatch;
      }),
    [templates, search, categoryFilter],
  );

  const onConfirmClone = () => {
    if (!cloneTarget) return;
    try {
      localStorage.setItem(
        'templateToAction',
        JSON.stringify(cloneTarget),
      );
    } catch {
      // ignore localStorage errors
    }
    toast({
      title: 'Template cloned',
      description: `Opening "${cloneTarget.name}" in the builder.`,
    });
    setCloneTarget(null);
    router.push('/wachat/templates/create?action=clone');
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Library</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader bordered={false}>
        <ZoruPageHeading>
          <button
            type="button"
            onClick={() => router.push('/wachat/templates')}
            className="mb-1 flex items-center gap-1 text-[12px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
          >
            <ChevronLeft className="h-3 w-3" /> Back to my templates
          </button>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-2">
              <BookCopy className="h-6 w-6" /> Template library
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Browse pre-made, high-quality templates to get started quickly.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <ZoruInput
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-64"
            />
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  {categoryFilter === 'ALL'
                    ? 'All categories'
                    : categoryFilter
                        .replace(/_/g, ' ')
                        .toLowerCase()}
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Category</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuRadioGroup
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  {categories.map((c) => (
                    <ZoruDropdownMenuRadioItem
                      key={c}
                      value={c}
                      className="capitalize"
                    >
                      {c === 'ALL'
                        ? 'All'
                        : c.replace(/_/g, ' ').toLowerCase()}
                    </ZoruDropdownMenuRadioItem>
                  ))}
                </ZoruDropdownMenuRadioGroup>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
          </div>
        </ZoruPageActions>
      </ZoruPageHeader>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <ZoruSkeleton key={i} className="h-96 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <ZoruEmptyState
          icon={<Search />}
          title="No templates found"
          description="Try adjusting your search or category filter."
          action={
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
              }}
            >
              Clear filters
            </ZoruButton>
          }
        />
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((template, index) => (
            <TemplateTile
              key={template.name + index}
              template={template}
              onUse={setCloneTarget}
            />
          ))}
        </div>
      )}

      {/* Clone-to-account dialog */}
      <ZoruDialog
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
                  }. You'll be taken to the builder to review and submit.`
                : ''}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton
              variant="ghost"
              onClick={() => setCloneTarget(null)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton onClick={onConfirmClone}>
              <BookCopy /> Clone &amp; open
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <div className="h-6" />
    </div>
  );
}
