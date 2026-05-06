'use client';
import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { BookOpen, LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';

import {
  saveKnowledgeBase,
  getKnowledgeBaseCategories,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsKnowledgeBaseCategory } from '@/lib/worksuite/knowledge-types';

export default function NewKnowledgeBasePage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction, isPending] = useActionState(saveKnowledgeBase, {
    message: '',
    error: '',
  } as any);
  const [categories, setCategories] = React.useState<
    (WsKnowledgeBaseCategory & { _id: string })[]
  >([]);

  useEffect(() => {
    getKnowledgeBaseCategories().then((c) => setCategories(c as any));
  }, []);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/workspace/knowledge-base');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Article"
        subtitle="Write a knowledge base article. Supports articles, videos, audio, images, documents."
        icon={BookOpen}
      />

      <ZoruCard>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="title" className="text-foreground">Title *</ZoruLabel>
            <ZoruInput id="title" name="title" required className="mt-1.5 h-10" />
          </div>

          <div className="md:col-span-2">
            <ZoruLabel htmlFor="description" className="text-foreground">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              rows={8}
              className="mt-1.5"
              placeholder="Write your article content here. Supports rich text."
            />
          </div>

          <div>
            <ZoruLabel htmlFor="category_id" className="text-foreground">Category</ZoruLabel>
            <ZoruSelect name="category_id">
              <ZoruSelectTrigger id="category_id" className="mt-1.5 h-10">
                <ZoruSelectValue placeholder="Select category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {categories.map((c) => (
                  <ZoruSelectItem key={c._id} value={c._id}>
                    {c.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div>
            <ZoruLabel htmlFor="type" className="text-foreground">Type *</ZoruLabel>
            <ZoruSelect name="type" defaultValue="article">
              <ZoruSelectTrigger id="type" className="mt-1.5 h-10">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="article">Article</ZoruSelectItem>
                <ZoruSelectItem value="video">Video</ZoruSelectItem>
                <ZoruSelectItem value="audio">Audio</ZoruSelectItem>
                <ZoruSelectItem value="image">Image</ZoruSelectItem>
                <ZoruSelectItem value="document">Document</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div>
            <ZoruLabel htmlFor="to_do" className="text-foreground">To-do</ZoruLabel>
            <ZoruSelect name="to_do" defaultValue="no">
              <ZoruSelectTrigger id="to_do" className="mt-1.5 h-10">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="no">No</ZoruSelectItem>
                <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div>
            <ZoruLabel htmlFor="pinned" className="text-foreground">Pinned</ZoruLabel>
            <ZoruSelect name="pinned" defaultValue="false">
              <ZoruSelectTrigger id="pinned" className="mt-1.5 h-10">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="false">No</ZoruSelectItem>
                <ZoruSelectItem value="true">Yes</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <ZoruButton variant="outline" type="button" onClick={() => router.back()}>
              Cancel
            </ZoruButton>
            <ZoruButton
             
              type="submit"
              disabled={isPending}
             
            >
              Save Article
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
