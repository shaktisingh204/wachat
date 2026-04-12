'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuMessageSquareHeart, LuSave, LuEye, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { getGreetingMessage, saveGreetingMessage } from '@/app/actions/wachat-features.actions';

const VARIABLES = ['{name}', '{phone}', '{email}', '{company}'];

export default function GreetingMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [enabled, setEnabled] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getGreetingMessage(projectId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      if (res.config) {
        setEnabled(res.config.enabled ?? false);
        setGreeting(res.config.message ?? '');
      }
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const rendered = greeting
    .replace(/\{name\}/g, 'John Doe')
    .replace(/\{phone\}/g, '+1 234 567 890')
    .replace(/\{email\}/g, 'john@example.com')
    .replace(/\{company\}/g, activeProject?.name || 'Acme Inc');

  const handleSave = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const res = await saveGreetingMessage(projectId, enabled, greeting);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Saved', description: 'Greeting message updated successfully.' });
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-clay-ink-muted" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Greeting Messages' },
        ]}
      />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
          Greeting Messages
        </h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">
          Configure the welcome message sent to contacts when they start a new conversation.
        </p>
      </div>

      <ClayCard padded={false} className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-clay-ink">Enable Greeting</h2>
            <p className="text-[12px] text-clay-ink-muted mt-0.5">
              Automatically send a greeting when a contact messages for the first time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-clay-rose' : 'bg-clay-border'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </ClayCard>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Message</h2>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          rows={4}
          placeholder="Type your greeting message..."
          className="clay-input min-h-[96px] resize-y py-2.5 w-full"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[12px] text-clay-ink-muted self-center">Insert:</span>
          {VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setGreeting((prev) => prev + ' ' + v)}
              className="rounded-md border border-clay-border bg-clay-bg px-2 py-1 text-[11px] font-mono text-clay-ink hover:bg-clay-bg-2 transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      </ClayCard>

      <ClayCard padded={false} className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-clay-ink">Preview</h2>
          <ClayButton size="sm" variant="ghost" onClick={() => setShowPreview(!showPreview)}>
            <LuEye className="mr-1.5 h-3.5 w-3.5" /> {showPreview ? 'Hide' : 'Show'}
          </ClayButton>
        </div>
        {showPreview && (
          <div className="rounded-clay-md border border-clay-border bg-clay-bg p-4">
            <div className="inline-block max-w-[80%] rounded-xl rounded-tl-sm bg-clay-surface-2 px-4 py-2.5 text-[13px] text-clay-ink">
              {rendered || <span className="text-clay-ink-muted italic">Empty message</span>}
            </div>
          </div>
        )}
      </ClayCard>

      <div className="flex items-center gap-3">
        <ClayButton variant="obsidian" onClick={handleSave} disabled={isSaving} leading={<LuSave className="h-4 w-4" />}>
          {isSaving ? 'Saving...' : 'Save Greeting'}
        </ClayButton>
      </div>
      <div className="h-6" />
    </div>
  );
}
