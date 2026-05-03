'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { BookOpen, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  saveKnowledgeBase,
  getKnowledgeBaseCategories,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsKnowledgeBaseCategory } from '@/lib/worksuite/knowledge-types';

export default function NewKnowledgeBasePage() {
  const router = useRouter();
  const { toast } = useToast();
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

      <ClayCard>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title" className="text-foreground">Title *</Label>
            <Input id="title" name="title" required className="mt-1.5 h-10" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description" className="text-foreground">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={8}
              className="mt-1.5"
              placeholder="Write your article content here. Supports rich text."
            />
          </div>

          <div>
            <Label htmlFor="category_id" className="text-foreground">Category</Label>
            <Select name="category_id">
              <SelectTrigger id="category_id" className="mt-1.5 h-10">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type" className="text-foreground">Type *</Label>
            <Select name="type" defaultValue="article">
              <SelectTrigger id="type" className="mt-1.5 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="to_do" className="text-foreground">To-do</Label>
            <Select name="to_do" defaultValue="no">
              <SelectTrigger id="to_do" className="mt-1.5 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pinned" className="text-foreground">Pinned</Label>
            <Select name="pinned" defaultValue="false">
              <SelectTrigger id="pinned" className="mt-1.5 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <ClayButton variant="pill" type="button" onClick={() => router.back()}>
              Cancel
            </ClayButton>
            <ClayButton
              variant="obsidian"
              type="submit"
              disabled={isPending}
              leading={
                isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null
              }
            >
              Save Article
            </ClayButton>
          </div>
        </form>
      </ClayCard>
    </div>
  );
}
