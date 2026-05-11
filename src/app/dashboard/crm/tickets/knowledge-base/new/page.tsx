'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Save, LoaderCircle, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { saveKbArticle } from '@/app/actions/crm-knowledge-base.actions';

export const dynamic = 'force-dynamic';

const initialState = { message: '', error: '', id: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save article'}
    </ZoruButton>
  );
}

export default function NewKbArticlePage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(saveKbArticle, initialState);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Article saved', description: state.message });
      router.push('/dashboard/crm/tickets/knowledge-base');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Knowledge Base Article"
        subtitle="Create a help article for customers or your support team."
        icon={BookOpen}
        actions={
          <ZoruButton variant="outline" size="sm" asChild>
            <Link href="/dashboard/crm/tickets/knowledge-base">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </ZoruButton>
        }
      />

      <form action={formAction} className="flex flex-col gap-6">
        {/* Card 1: Article Details */}
        <ZoruCard className="p-6">
          <div className="mb-5">
            <h2 className="text-[15px] font-medium text-zoru-ink">Article Details</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              Basic metadata for this knowledge base article.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Title */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <ZoruLabel htmlFor="title">
                Title <span className="text-red-500">*</span>
              </ZoruLabel>
              <ZoruInput
                id="title"
                name="title"
                type="text"
                required
                placeholder="e.g. How to reset your password"
              />
            </div>

            {/* Slug */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="slug">Slug</ZoruLabel>
              <ZoruInput
                id="slug"
                name="slug"
                type="text"
                placeholder="Auto-generated from title"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="category">Category</ZoruLabel>
              <ZoruInput
                id="category"
                name="category"
                type="text"
                placeholder="e.g. Billing, Onboarding"
              />
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
              <ZoruInput
                id="tags"
                name="tags"
                type="text"
                placeholder="Comma-separated: billing, setup, ..."
              />
            </div>

            {/* Visibility */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="visibility">Visibility</ZoruLabel>
              <ZoruSelect name="visibility" defaultValue="internal">
                <ZoruSelectTrigger id="visibility">
                  <ZoruSelectValue placeholder="Select visibility" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="public">Public</ZoruSelectItem>
                  <ZoruSelectItem value="portal">Customer Portal</ZoruSelectItem>
                  <ZoruSelectItem value="internal">Internal Only</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="status">Status</ZoruLabel>
              <ZoruSelect name="status" defaultValue="draft">
                <ZoruSelectTrigger id="status">
                  <ZoruSelectValue placeholder="Select status" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                  <ZoruSelectItem value="published">Published</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
        </ZoruCard>

        {/* Card 2: Content */}
        <ZoruCard className="p-6">
          <div className="mb-5">
            <h2 className="text-[15px] font-medium text-zoru-ink">Content</h2>
            <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
              The full body of the article. Markdown is supported.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="body">
              Body <span className="text-red-500">*</span>
            </ZoruLabel>
            <ZoruTextarea
              id="body"
              name="body"
              required
              rows={15}
              placeholder="Write the article content here. Markdown supported."
            />
          </div>
        </ZoruCard>

        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
