'use client';

import {
  Button,
  Card,
  CardBody,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Badge,
  useToast,
} from '@/components/sabcrm/20ui';
import WachatPage from '@/app/wachat/_components/wachat-page';
import {
  useRouter } from 'next/navigation';
import { useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import {
  BookCopy,
  Check,
  ChevronDown,
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
import { useTemplateStore } from '../template-store';

/**
 * Wachat Template Library — premade templates grid, rebuilt on
 * 20ui primitives. Click a template to open clone-to-account dialog.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
        <span key={i} className="font-bold" style={{ color: 'var(--st-text)' }}>
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
        return <LinkIcon className="mr-2 h-4 w-4" aria-hidden="true" />;
      case 'PHONE_NUMBER':
        return <Phone className="mr-2 h-4 w-4" aria-hidden="true" />;
      case 'QUICK_REPLY':
        return <Star className="mr-2 h-4 w-4" aria-hidden="true" />;
      default:
        return null;
    }
  };

  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const baseRating = 4.5; // Mock base rating for community templates
  const baseReviews = 12; // Mock reviews count
  const aggregateRating = userRating ? ((baseRating * baseReviews + userRating) / (baseReviews + 1)) : baseRating;
  const reviewCount = userRating ? baseReviews + 1 : baseReviews;

  return (
    <Card variant="elevated" padding="none" className="flex flex-col">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-[14px] font-semibold capitalize"
            style={{ color: 'var(--st-text)' }}
          >
            {template.name.replace(/_/g, ' ')}
          </h3>
          <Badge tone="neutral" className="capitalize">
            {template.category.replace(/_/g, ' ').toLowerCase()}
          </Badge>
        </div>

        <p className="text-[12px]" style={{ color: 'var(--st-text-secondary)' }}>
          A pre-built template for{' '}
          {template.category.replace(/_/g, ' ').toLowerCase()} use cases.
        </p>

        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = hoverRating ? star <= hoverRating : star <= Math.round(aggregateRating);
              return (
                <button
                  key={star}
                  type="button"
                  className="focus:outline-none"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  aria-pressed={star <= Math.round(aggregateRating)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => {
                    setUserRating(star);
                    // Could also dispatch a toast or API call here
                  }}
                >
                  <Star
                    className="h-3.5 w-3.5 transition-colors"
                    aria-hidden="true"
                    style={{
                      fill: active ? 'var(--st-warn)' : 'none',
                      color: active ? 'var(--st-warn)' : 'var(--st-border)',
                    }}
                  />
                </button>
              );
            })}
          </div>
          <span className="text-[11px]" style={{ color: 'var(--st-text-secondary)' }}>
            {aggregateRating.toFixed(1)} ({reviewCount} reviews)
          </span>
        </div>

        <div
          className="flex-1 p-4"
          style={{
            borderRadius: 'var(--st-radius)',
            border: '1px solid var(--st-border)',
            background: 'var(--st-bg-secondary)',
          }}
        >
          <div className="mx-auto w-full max-w-xs">
            <div
              className="space-y-2 p-3 text-sm"
              style={{
                borderRadius: 'var(--st-radius)',
                background: 'var(--st-bg)',
                color: 'var(--st-text)',
                boxShadow: 'var(--st-shadow-sm)',
              }}
            >
              {headerComponent &&
                (headerComponent.format === 'IMAGE' ||
                  headerComponent.format === 'VIDEO' ||
                  headerComponent.format === 'DOCUMENT') && (
                  <div
                    className="mb-2 flex aspect-video items-center justify-center rounded-md"
                    style={{ background: 'var(--st-bg-secondary)' }}
                  >
                    <ImageIcon
                      className="h-10 w-10"
                      aria-hidden="true"
                      style={{ color: 'var(--st-text-tertiary)' }}
                    />
                  </div>
                )}
              {headerComponent && headerComponent.format === 'TEXT' && (
                <h3 className="mb-1 text-base font-bold" style={{ color: 'var(--st-text)' }}>
                  {headerComponent.text}
                </h3>
              )}
              <p className="whitespace-pre-wrap">
                {renderTextWithVariables(template.body)}
              </p>
              {footerComponent && (
                <p className="pt-1 text-xs" style={{ color: 'var(--st-text-secondary)' }}>
                  {footerComponent.text}
                </p>
              )}
            </div>
            {buttons.length > 0 && (
              <div className="mt-2 space-y-1">
                {buttons.map((button: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-center p-2 text-center text-sm font-medium"
                    style={{
                      borderRadius: 'var(--st-radius)',
                      border: '1px solid var(--st-border)',
                      background: 'var(--st-bg)',
                      color: 'var(--st-text)',
                      boxShadow: 'var(--st-shadow-sm)',
                    }}
                  >
                    {getButtonIcon(button.type)}
                    {button.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Button
          variant="primary"
          block
          className="mt-auto"
          onClick={() => onUse(template)}
        >
          Use this template
        </Button>
      </CardBody>
    </Card>
  );
}

/* ── Page ──────────────────────────────────────── */

export default function TemplateLibraryPage() {
  const router = useRouter();
  const { activeProject } = useProject();
  const { toast } = useToast();
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
    setTemplateToAction(cloneTarget);
    toast({
      title: 'Template cloned',
      description: `Opening "${cloneTarget.name}" in the builder.`,
      tone: 'success',
    });
    setCloneTarget(null);
    router.push('/wachat/templates/create?action=clone');
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Templates', href: '/wachat/templates' },
        { label: 'Library' },
      ]}
      eyebrow={
        <button
          type="button"
          onClick={() => router.push('/wachat/templates')}
          className="flex items-center gap-1 text-[12px] transition-colors"
          style={{ color: 'var(--st-text-secondary)' }}
        >
          <ChevronLeft className="h-3 w-3" aria-hidden="true" /> Back to my templates
        </button>
      }
      title={
        <span className="inline-flex items-center gap-2">
          <BookCopy className="h-6 w-6" aria-hidden="true" /> Template library
        </span>
      }
      description="Browse pre-made, high-quality templates to get started quickly."
      width="wide"
      actions={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Field className="sm:w-64">
            <Input
              placeholder="Search templates…"
              aria-label="Search templates"
              iconLeft={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Menu
            align="end"
            label="Category"
            trigger={
              <Button variant="outline" size="sm" iconRight={ChevronDown}>
                {categoryFilter === 'ALL'
                  ? 'All categories'
                  : categoryFilter.replace(/_/g, ' ').toLowerCase()}
              </Button>
            }
          >
            <MenuLabel>Category</MenuLabel>
            <MenuSeparator />
            {categories.map((c) => (
              <MenuItem
                key={c}
                icon={categoryFilter === c ? Check : undefined}
                onSelect={() => setCategoryFilter(c)}
                className="capitalize"
              >
                {c === 'ALL' ? 'All' : c.replace(/_/g, ' ').toLowerCase()}
              </MenuItem>
            ))}
          </Menu>
        </div>
      }
    >
      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="w-full" height="24rem" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No templates found"
          description="Try adjusting your search or category filter."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
              }}
            >
              Clear filters
            </Button>
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
      <Modal
        open={Boolean(cloneTarget)}
        onClose={() => setCloneTarget(null)}
        title="Clone to your account"
        description={
          cloneTarget
            ? `Clone "${cloneTarget.name.replace(/_/g, ' ')}" into ${
                activeProject?.name || 'your project'
              }. You'll be taken to the builder to review and submit.`
            : ''
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloneTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft={BookCopy} onClick={onConfirmClone}>
              Clone &amp; open
            </Button>
          </>
        }
      />
    </WachatPage>
  );
}
