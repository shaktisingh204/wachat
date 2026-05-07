'use client';

/**
 * /dashboard/facebook/flow-builder — visual flow editor shell (ZoruUI).
 *
 * The original page redirects to the e-commerce flow-builder. We keep
 * that behaviour but wrap the transition in the Zoru chrome so the
 * route never falls back to legacy clay/wabasimplify visuals while the
 * router swap is in flight.
 *
 * The actual canvas lives at:
 *   /dashboard/facebook/custom-ecommerce/manage/[shopId]/flow-builder
 *
 * Per Phase 9 rules we restyle the CHROME only — header, save bar,
 * and side rail. Canvas internals are intentionally opaque.
 *
 * TODO(meta-zoru): once a Meta-Suite-native flow-builder canvas lands
 * here directly (instead of redirecting), wire up the save / undo /
 * publish handlers in this shell. For now they are stubs that surface
 * a toast.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  CircleDashed,
  History,
  Loader2,
  PanelRightOpen,
  Play,
  Plus,
  Save,
  Sparkles,
  Workflow,
} from 'lucide-react';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSeparator,
  useZoruToast,
} from '@/components/zoruui';

const SIDE_RAIL_BLOCKS = [
  { name: 'Send Message', icon: Sparkles },
  { name: 'Quick Replies', icon: Workflow },
  { name: 'Get User Input', icon: ChevronRight },
  { name: 'Add Condition', icon: CircleDashed },
  { name: 'Call API', icon: PanelRightOpen },
  { name: 'Add Delay', icon: History },
];

export default function FacebookFlowBuilderPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [redirecting] = React.useState(false);

  // TODO(meta-zoru): wire to real save/publish actions when a
  // Meta-Suite-native canvas lives in this route.
  const handleSave = () => {
    toast({
      title: 'Not available here',
      description:
        'Open a shop from Custom E-commerce to use the flow builder canvas.',
    });
  };

  const handlePublish = () => {
    toast({
      title: 'Not available here',
      description:
        'Publishing is performed inside a shop’s flow builder.',
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Flow Builder</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* Page header */}
      <ZoruPageHeader className="mt-4">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite · Tools</ZoruPageEyebrow>
          <ZoruPageTitle>Flow Builder</ZoruPageTitle>
          <ZoruPageDescription>
            Visual editor for Messenger automations. Drag blocks from the
            rail onto the canvas to build branching conversations.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/facebook/flow-builder/docs')}
          >
            <BookOpen /> Docs
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft /> Back
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* Save bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
            <Workflow className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-zoru-ink leading-tight">
              Untitled flow
            </p>
            <p className="text-[11px] text-zoru-ink-muted leading-tight">
              No unsaved changes
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={handleSave}>
            <Save /> Save draft
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" disabled>
            <History /> History
          </ZoruButton>
          <ZoruSeparator orientation="vertical" className="hidden h-5 sm:block" />
          <ZoruButton size="sm" onClick={handlePublish}>
            <Play /> Publish
          </ZoruButton>
        </div>
      </div>

      {/* Editor body: side rail + canvas placeholder */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Side rail (chrome only — the real palette lives in the
            shop-scoped flow builder). */}
        <ZoruCard className="flex flex-col gap-3 p-3">
          <div className="px-2 pt-1.5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zoru-ink-subtle">
              Blocks
            </p>
          </div>
          <div className="flex flex-col gap-1">
            {SIDE_RAIL_BLOCKS.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={handleSave}
                className="flex w-full items-center gap-2.5 rounded-[var(--zoru-radius-sm)] px-2.5 py-2 text-left text-[13px] text-zoru-ink transition-colors hover:bg-zoru-surface focus-visible:outline-none"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink-muted [&_svg]:size-3.5">
                  <b.icon />
                </span>
                <span className="truncate">{b.name}</span>
              </button>
            ))}
          </div>
          <ZoruSeparator />
          <ZoruButton variant="outline" size="sm" onClick={handleSave}>
            <Plus /> New block
          </ZoruButton>
        </ZoruCard>

        {/* Canvas placeholder — actual canvas is opaque per Phase 9 rules.
            We render a neutral frame around it. */}
        <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-[var(--zoru-radius-lg)] border border-dashed border-zoru-line bg-zoru-bg">
          {/* TODO(meta-zoru): when a Meta-Suite-native canvas component
              exists, mount it here. Until then the chrome wraps a
              redirect-in-progress state that points users at the
              shop-scoped flow builder. */}
          <ZoruEmptyState
            icon={
              redirecting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Workflow />
              )
            }
            title={
              redirecting
                ? 'Redirecting to Custom E-commerce'
                : 'Pick a shop to start building'
            }
            description="Flow builder runs inside a custom e-commerce shop. Choose a shop to open its canvas, save bar, and runtime."
            action={
              <ZoruButton
                size="sm"
                onClick={() =>
                  router.push('/dashboard/facebook/custom-ecommerce')
                }
              >
                Open Custom E-commerce <ChevronRight />
              </ZoruButton>
            }
          />
        </div>
      </div>
    </div>
  );
}
