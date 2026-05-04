'use client';

/**
 * /wachat/greeting-messages — single-form page (one config per project).
 * ZoruUI: header + breadcrumb, ZoruSwitch for activate, ZoruTextarea for
 * body, ZoruCard for preview. Skeleton on initial load.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getGreetingMessage,
  saveGreetingMessage,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

const VARIABLES = ['{name}', '{phone}', '{email}', '{company}'];

export default function GreetingMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [enabled, setEnabled] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getGreetingMessage(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      if (res.config) {
        setEnabled(res.config.enabled ?? false);
        setGreeting(res.config.message ?? '');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rendered = greeting
    .replace(/\{name\}/g, 'John Doe')
    .replace(/\{phone\}/g, '+1 234 567 890')
    .replace(/\{email\}/g, 'john@example.com')
    .replace(/\{company\}/g, activeProject?.name || 'Acme Inc');

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const res = await saveGreetingMessage(projectId, enabled, greeting);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Saved',
        description: 'Greeting message updated successfully.',
      });
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <ZoruSkeleton className="h-3 w-52" />
        <div className="mt-5 space-y-3">
          <ZoruSkeleton className="h-9 w-72" />
          <ZoruSkeleton className="h-4 w-96" />
        </div>
        <div className="mt-8 grid gap-4">
          <ZoruSkeleton className="h-24" />
          <ZoruSkeleton className="h-40" />
          <ZoruSkeleton className="h-32" />
        </div>
      </div>
    );
  }

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
            <ZoruBreadcrumbPage>Greeting Messages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat</ZoruPageEyebrow>
          <ZoruPageTitle>Greeting Messages</ZoruPageTitle>
          <ZoruPageDescription>
            Configure the welcome message sent to contacts when they start a new
            conversation.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton onClick={handleSave} disabled={isSaving}>
            <Save /> {isSaving ? 'Saving…' : 'Save'}
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <div className="mt-6 grid gap-4">
        {/* Activate switch */}
        <ZoruCard className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] text-zoru-ink">Enable greeting</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                Automatically send a greeting when a contact messages for the
                first time.
              </p>
            </div>
            <ZoruSwitch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Enable greeting"
            />
          </div>
        </ZoruCard>

        {/* Message body */}
        <ZoruCard className="p-5">
          <div className="flex flex-col gap-3">
            <ZoruLabel htmlFor="greeting-body">Message</ZoruLabel>
            <ZoruTextarea
              id="greeting-body"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={4}
              placeholder="Type your greeting message…"
              className="min-h-[96px]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-zoru-ink-muted">Insert:</span>
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setGreeting((prev) => prev + ' ' + v)}
                  className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-2 py-1 font-mono text-[11px] text-zoru-ink transition-colors hover:bg-zoru-surface"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </ZoruCard>

        {/* Preview */}
        <ZoruCard className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] text-zoru-ink">Preview</h2>
            <ZoruButton
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? <EyeOff /> : <Eye />}
              {showPreview ? 'Hide' : 'Show'}
            </ZoruButton>
          </div>
          {showPreview && (
            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
              <div className="inline-block max-w-[80%] rounded-[var(--zoru-radius)] bg-zoru-surface-2 px-4 py-2.5 text-[13px] text-zoru-ink">
                {rendered || (
                  <span className="italic text-zoru-ink-muted">
                    Empty message
                  </span>
                )}
              </div>
            </div>
          )}
        </ZoruCard>
      </div>
    </div>
  );
}
