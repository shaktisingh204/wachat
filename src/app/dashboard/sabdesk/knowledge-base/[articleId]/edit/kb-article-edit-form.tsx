'use client';

import { Button, Card, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  Save,
  LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { updateKbArticle } from '@/app/actions/crm-knowledge-base.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

const initialState: { message?: string; error?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save changes
    </Button>
  );
}

export default function KbArticleEditForm({
  article,
  articleId,
}: {
  article: Record<string, any>;
  articleId: string;
}) {
  const [state, formAction] = useActionState(updateKbArticle, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Updated', description: state.message });
      router.push(`/dashboard/sabdesk/knowledge-base/${articleId}`);
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router, articleId]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="articleId" value={articleId} />

      {/* Article Details Card */}
      <Card className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">Article Details</h2>
        <div className="flex flex-col gap-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              name="title"
              defaultValue={article.title ?? ''}
              placeholder="Article title"
              required
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={article.slug ?? ''}
              placeholder="auto-generated-from-title"
            />
          </div>

          {/* Category + Visibility in 2 cols */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <EntityFormField
                entity="category"
                name="category"
                initialLabel={article.category ?? ''}
                placeholder="e.g. Billing, Onboarding"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <EnumFormField
                enumName="kbVisibility"
                name="visibility"
                initialId={article.visibility ?? 'internal'}
                placeholder="Select visibility"
              />
            </div>
          </div>

          {/* Tags + Status in 2 cols */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                defaultValue={
                  Array.isArray(article.tags) ? article.tags.join(', ') : (article.tags ?? '')
                }
                placeholder="Comma-separated tags"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <EnumFormField
                enumName="kbStatus"
                name="status"
                initialId={article.status ?? 'draft'}
                placeholder="Select status"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Content Card */}
      <Card className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">Content</h2>
        <div className="space-y-1.5">
          <Label htmlFor="body">Article Body *</Label>
          <Textarea
            id="body"
            name="body"
            defaultValue={article.body ?? ''}
            placeholder="Write the article content here…"
            rows={15}
            required
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="text-zoru-ink-muted hover:text-zoru-ink">
          <Link href={`/dashboard/sabdesk/knowledge-base/${articleId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Link>
        </Button>
        <SubmitButton />
      </div>
    </form>
  );
}
