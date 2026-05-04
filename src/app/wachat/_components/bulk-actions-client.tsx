'use client';

/**
 * BulkActionsClient (wachat-local, ZoruUI)
 *
 * The bulk-operations workspace: pick targets, then either
 *   (a) replicate an existing template across all selected projects,
 *   (b) upload one CSV and round-robin a broadcast across them,
 *   (c) jump to the bulk template builder.
 *
 * Server-actions preserved 1:1:
 *   handleApplyTemplateToProjects, handleBulkBroadcast.
 */

import * as React from 'react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Send } from 'lucide-react';
import type { WithId } from 'mongodb';

import type { Project, Template } from '@/lib/definitions';
import { handleApplyTemplateToProjects } from '@/app/actions/template.actions';
import { handleBulkBroadcast } from '@/app/actions/broadcast.actions';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';

interface BulkActionsClientProps {
  sourceProjectName: string;
  allProjects: WithId<Project>[];
  initialTemplates: WithId<Template>[];
  initialSelectedProjects: WithId<Project>[];
}

export function BulkActionsClient({
  sourceProjectName,
  allProjects: _allProjects,
  initialTemplates,
  initialSelectedProjects,
}: BulkActionsClientProps) {
  const [selectedProjects] =
    useState<WithId<Project>[]>(initialSelectedProjects);
  const router = useRouter();

  useEffect(() => {
    document.title = 'Bulk Actions | SabNode';
  }, []);

  const handleCreateTemplateClick = () => {
    localStorage.setItem(
      'bulkProjectIds',
      JSON.stringify(selectedProjects.map((p) => p._id.toString())),
    );
    router.push('/wachat/bulk/template');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
            Bulk operations
          </h2>
          <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
            Performing actions on {selectedProjects.length} selected project
            {selectedProjects.length === 1 ? '' : 's'}.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <BulkTemplateForm
            sourceProjectName={sourceProjectName}
            targetProjects={selectedProjects}
            templates={initialTemplates}
          />
        </div>
        <div className="lg:col-span-1">
          <BulkBroadcastForm
            sourceProjectName={sourceProjectName}
            targetProjects={selectedProjects}
          />
        </div>
        <div className="lg:col-span-1">
          <button
            type="button"
            onClick={handleCreateTemplateClick}
            className="flex h-full min-h-48 w-full flex-row items-center gap-4 rounded-[var(--zoru-radius-lg)] border border-zoru-ink bg-zoru-ink px-5 py-5 text-left text-zoru-on-primary transition-colors hover:bg-zoru-ink/90 focus-visible:outline-none"
          >
            <FileText className="h-8 w-8 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="text-[15px]">Create &amp; Apply New Template</p>
              <p className="text-[12px] text-zoru-on-primary/80">
                Build a template from scratch and apply to all.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 *  BulkTemplateForm — replicate one existing template across projects
 * ══════════════════════════════════════════════════════════════════ */

interface BulkTemplateFormProps {
  sourceProjectName: string;
  targetProjects: WithId<Project>[];
  templates: WithId<Template>[];
}

function BulkTemplateForm({
  sourceProjectName,
  targetProjects,
  templates,
}: BulkTemplateFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      toast({
        title: 'No template selected',
        description: 'Please choose a template to apply.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const projectIds = targetProjects.map((p) => p._id.toString());
      const result = await handleApplyTemplateToProjects(
        selectedTemplate,
        projectIds,
      );

      if (result.success) {
        toast({
          title: 'Success!',
          description: 'Template applied to all selected projects.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <ZoruCard>
      <form onSubmit={handleSubmit}>
        <ZoruCardHeader>
          <ZoruCardTitle>Bulk Add Template</ZoruCardTitle>
          <ZoruCardDescription>
            Choose a template from &quot;{sourceProjectName}&quot; to add to
            all selected projects.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="space-y-2">
            <ZoruLabel htmlFor="template-select">Template to Apply</ZoruLabel>
            <ZoruSelect
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
            >
              <ZoruSelectTrigger id="template-select">
                <ZoruSelectValue placeholder="Select a template..." />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {templates.map((t) => (
                  <ZoruSelectItem
                    key={t._id.toString()}
                    value={t._id.toString()}
                  >
                    {t.name} ({t.language})
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <p className="text-xs text-zoru-ink-muted">
              This will add or update the template with the same name and
              language in each selected project.
            </p>
          </div>
        </ZoruCardContent>
        <ZoruCardFooter>
          <ZoruButton
            type="submit"
            disabled={!selectedTemplate || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply to All
          </ZoruButton>
        </ZoruCardFooter>
      </form>
    </ZoruCard>
  );
}

/* ══════════════════════════════════════════════════════════════════
 *  BulkBroadcastForm — round-robin one CSV across N projects
 * ══════════════════════════════════════════════════════════════════ */

const bulkBroadcastInitialState = {
  message: null,
  error: null,
};

function BulkBroadcastSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending || disabled}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      Distribute &amp; Send
    </ZoruButton>
  );
}

interface BulkBroadcastFormProps {
  sourceProjectName: string;
  targetProjects: WithId<Project>[];
}

function BulkBroadcastForm({
  sourceProjectName: _sourceProjectName,
  targetProjects,
}: BulkBroadcastFormProps) {
  const [state, formAction] = React.useActionState(
    handleBulkBroadcast as any,
    bulkBroadcastInitialState as any,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setFile(null);
    }
    if (state?.error) {
      toast({
        title: 'Error Starting Broadcasts',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <ZoruCard>
      <form action={formAction} ref={formRef}>
        <input
          type="hidden"
          name="projectIds"
          value={targetProjects.map((p) => p._id.toString()).join(',')}
        />
        <ZoruCardHeader>
          <ZoruCardTitle>Bulk Broadcast from File</ZoruCardTitle>
          <ZoruCardDescription>
            Upload a single contact file. The contacts will be evenly
            distributed and sent from all {targetProjects.length} selected
            projects.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="space-y-2">
            <ZoruLabel htmlFor="templateName">Template Name</ZoruLabel>
            <ZoruInput
              id="templateName"
              name="templateName"
              required
              placeholder="e.g., offer_update_v2"
            />
            <p className="text-xs text-zoru-ink-muted">
              This template must exist with the same name and language across
              all selected projects.
            </p>
          </div>
          <div className="space-y-2">
            <ZoruLabel htmlFor="language">Language Code</ZoruLabel>
            <ZoruInput
              id="language"
              name="language"
              required
              placeholder="e.g., en_US"
              defaultValue="en_US"
            />
          </div>
          <div className="space-y-2">
            <ZoruLabel htmlFor="contactFile">Contact File</ZoruLabel>
            <ZoruInput
              id="contactFile"
              name="contactFile"
              type="file"
              required
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-zoru-ink-muted">
              A CSV or XLSX file. The first column must be the phone number.
            </p>
          </div>
        </ZoruCardContent>
        <ZoruCardFooter>
          <BulkBroadcastSubmit disabled={!file} />
        </ZoruCardFooter>
      </form>
    </ZoruCard>
  );
}
