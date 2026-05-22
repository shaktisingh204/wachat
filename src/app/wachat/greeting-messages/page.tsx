'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Eye,
  EyeOff,
  Save } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getGreetingMessage,
  saveGreetingMessage,
  } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/greeting-messages — single-form page (one config per project).
 * ZoruUI: header + breadcrumb, Switch for activate, Textarea for
 * body, Card for preview. Skeleton on initial load.
 */

import * as React from 'react';

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
        <Skeleton className="h-3 w-52" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="mt-8 grid gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbPage>Greeting Messages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat</ZoruPageEyebrow>
          <ZoruPageTitle>Greeting Messages</ZoruPageTitle>
          <ZoruPageDescription>
            Configure the welcome message sent to contacts when they start a new
            conversation.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save /> {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6 grid gap-4">
        {/* Activate switch */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] text-zoru-ink">Enable greeting</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                Automatically send a greeting when a contact messages for the
                first time.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Enable greeting"
            />
          </div>
        </Card>

        {/* Message body */}
        <Card className="p-5">
          <div className="flex flex-col gap-3">
            <Label htmlFor="greeting-body">Message</Label>
            <Textarea
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
        </Card>

        {/* Preview */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] text-zoru-ink">Preview</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? <EyeOff /> : <Eye />}
              {showPreview ? 'Hide' : 'Show'}
            </Button>
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
        </Card>
      </div>
    </div>
  );
}
