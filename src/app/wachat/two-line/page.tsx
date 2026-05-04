'use client';

/**
 * Wachat Two-Line — ZoruUI migration.
 * Concept overview + activate dialog. The "live preview" is now a
 * neutral inline mock of the two-line shell — no legacy sidebar
 * dependency.
 */

import * as React from 'react';
import { useState } from 'react';
import { ArrowRight, Layers, MessageSquare, Phone, Shield, Sparkles } from 'lucide-react';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';

export default function TwoLineSidebarDemoPage() {
  const { toast } = useZoruToast();
  const [activateOpen, setActivateOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Two-line</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Two-line workspace
          </h1>
          <p className="mt-1.5 max-w-[680px] text-[13px] text-zoru-ink-muted">
            Run two distinct WhatsApp lines side-by-side — keep sales and
            support inboxes isolated while sharing one team and one billing
            plan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
            <ZoruSwitch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Two-line preview"
            />
            {enabled ? 'Preview on' : 'Preview off'}
          </span>
          <ZoruButton onClick={() => setActivateOpen(true)}>
            Activate two-line <ArrowRight />
          </ZoruButton>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FeatureCard
          icon={<Layers />}
          title="Two inboxes, one team"
          description="Each line keeps its own conversation history, labels, and templates — agents toggle in a click."
        />
        <FeatureCard
          icon={<Shield />}
          title="Tighter access control"
          description="Scope agents and bots to a single line. Compliance teams see exactly who can act on which number."
        />
        <FeatureCard
          icon={<Sparkles />}
          title="Independent quality"
          description="Each line keeps its own Meta quality score, so a bad campaign on one number can't drag the other down."
        />
      </div>

      <ZoruCard className="mt-6 overflow-hidden p-0">
        <div className="border-b border-zoru-line px-5 py-3">
          <p className="text-[12px] uppercase tracking-wide text-zoru-ink-muted">
            Live preview
          </p>
        </div>
        <div className="p-6">
          <TwoLinePreview />
        </div>
      </ZoruCard>

      <ZoruDialog open={activateOpen} onOpenChange={setActivateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Activate two-line workspace?</ZoruDialogTitle>
            <ZoruDialogDescription>
              Two-line is billed per active line. Once activated, your
              second number will be visible to all teammates with project
              access.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setActivateOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                toast({
                  title: 'Two-line activated',
                  description: 'Your workspace now supports two WhatsApp lines.',
                });
                setActivateOpen(false);
                setEnabled(true);
              }}
            >
              Activate
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <div className="h-6" />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <ZoruCard className="p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
        {icon}
      </span>
      <h3 className="mt-3 text-[15px] text-zoru-ink leading-tight">{title}</h3>
      <p className="mt-1 text-[12.5px] text-zoru-ink-muted leading-relaxed">
        {description}
      </p>
    </ZoruCard>
  );
}

/* ── Two-line preview mock ─────────────────────────────────────────
   Neutral, zoru-token-only mock of the two-line workspace. Two stacked
   conversation rows, each labelled with its line. Replaces the legacy
   Frame760 phone-frame preview. */

function TwoLinePreview() {
  const lines = [
    {
      id: 'a',
      number: '+1 415 555 0142',
      label: 'Sales line',
      preview: 'New invoice posted for Acme Co.',
      time: '2m',
      unread: 3,
    },
    {
      id: 'b',
      number: '+1 415 555 0177',
      label: 'Support line',
      preview: 'Closed ticket #4218 — refund issued',
      time: '14m',
      unread: 0,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {lines.map((line) => (
        <div
          key={line.id}
          className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-bg text-zoru-ink-muted">
              <Phone className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-zoru-ink">{line.label}</p>
              <p className="truncate text-[10px] text-zoru-ink-muted">
                {line.number}
              </p>
            </div>
            {line.unread > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zoru-ink px-1.5 text-[10px] text-zoru-on-primary">
                {line.unread}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zoru-ink-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-zoru-ink">{line.preview}</p>
              <p className="mt-0.5 text-[10px] text-zoru-ink-muted">{line.time} ago</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
