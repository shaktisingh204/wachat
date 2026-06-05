'use client';

import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { FileText,
  Loader2,
  Send } from 'lucide-react';
import type { WithId } from 'mongodb';

import type { Project,
  Template } from '@/lib/definitions';
import { handleApplyTemplateToProjects } from '@/app/actions/template.actions';
import { handleBulkBroadcast } from '@/app/actions/broadcast.actions';

/**
 * BulkActionsClient (wachat-local, 20ui)
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

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
    router.push('/wachat/broadcasts/bulk-template');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2
            className="leading-none"
            style={{
              fontSize: '22px',
              letterSpacing: '-0.01em',
              color: 'var(--st-text)',
            }}
          >
            Bulk operations
          </h2>
          <p
            className="mt-1.5"
            style={{ fontSize: '12.5px', color: 'var(--st-text-muted)' }}
          >
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
            className="flex h-full min-h-48 w-full flex-row items-center gap-4 px-5 py-5 text-left transition-colors focus-visible:outline-none"
            style={{
              borderRadius: 'var(--st-radius-lg)',
              border: '1px solid var(--st-text)',
              background: 'var(--st-text)',
              color: 'var(--st-bg)',
            }}
          >
            <FileText className="h-8 w-8 shrink-0" />
            <div className="flex flex-col gap-1">
              <p style={{ fontSize: '15px' }}>Create &amp; Apply New Template</p>
              <p style={{ fontSize: '12px', opacity: 0.8 }}>
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
  const { toast } = useToast();

  const templateOptions = templates.map((t) => ({
    value: t._id.toString(),
    label: `${t.name} (${t.language})`,
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      toast({
        title: 'No template selected',
        description: 'Please choose a template to apply.',
        tone: 'danger',
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
          tone: 'success',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error,
          tone: 'danger',
        });
      }
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Bulk Add Template</CardTitle>
          <CardDescription>
            Choose a template from &quot;{sourceProjectName}&quot; to add to
            all selected projects.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <Field
              label="Template to Apply"
              help="This will add or update the template with the same name and language in each selected project."
            >
              <Select
                id="template-select"
                value={selectedTemplate || null}
                onChange={(v) => setSelectedTemplate(v ?? '')}
                options={templateOptions}
                placeholder="Select a template..."
                aria-label="Template to Apply"
              />
            </Field>
          </div>
        </CardBody>
        <CardFooter>
          <Button
            variant="primary"
            type="submit"
            disabled={!selectedTemplate || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply to All
          </Button>
        </CardFooter>
      </form>
    </Card>
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
    <Button variant="primary" type="submit" disabled={pending || disabled}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      Distribute &amp; Send
    </Button>
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
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message, tone: 'success' });
      formRef.current?.reset();
      setFile(null);
    }
    if (state?.error) {
      toast({
        title: 'Error Starting Broadcasts',
        description: state.error,
        tone: 'danger',
      });
    }
  }, [state, toast]);

  return (
    <Card>
      <form action={formAction} ref={formRef}>
        <input
          type="hidden"
          name="projectIds"
          value={targetProjects.map((p) => p._id.toString()).join(',')}
        />
        <CardHeader>
          <CardTitle>Bulk Broadcast from File</CardTitle>
          <CardDescription>
            Upload a single contact file. The contacts will be evenly
            distributed and sent from all {targetProjects.length} selected
            projects.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <Field
              label="Template Name"
              help="This template must exist with the same name and language across all selected projects."
            >
              <Input
                id="templateName"
                name="templateName"
                required
                placeholder="e.g., offer_update_v2"
              />
            </Field>
          </div>
          <div className="space-y-2">
            <Field label="Language Code">
              <Input
                id="language"
                name="language"
                required
                placeholder="e.g., en_US"
                defaultValue="en_US"
              />
            </Field>
          </div>
          <div className="space-y-2">
            <Field
              label="Contact File"
              help="A CSV or XLSX file. The first column must be the phone number."
            >
              <Input
                id="contactFile"
                name="contactFile"
                type="file"
                required
                accept=".csv,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
          </div>
        </CardBody>
        <CardFooter>
          <BulkBroadcastSubmit disabled={!file} />
        </CardFooter>
      </form>
    </Card>
  );
}
