'use client';

import {
  Button,
  Card,
  CardBody,
  Field,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createInstagramImagePost } from '@/app/actions/instagram.actions';

import { SabFileUrlInput } from '@/components/sabfiles';
import { Newspaper, Send, X } from 'lucide-react';

const initialState: any = { message: null, error: null };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" iconLeft={Send} loading={pending} disabled={disabled}>
      Publish post
    </Button>
  );
}

export default function CreateInstagramPostPage() {
  const [state, formAction] = useActionState(createInstagramImagePost, initialState);
  const { toast } = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');

  useEffect(() => {
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  useEffect(() => {
    if (state.message) {
      toast({ tone: 'success', title: 'Post published', description: state.message });
      formRef.current?.reset();
      setImageUrl('');
      setCaption('');
      router.push('/dashboard/instagram/feed');
    }
    if (state.error) {
      toast({ tone: 'danger', title: 'Could not publish', description: state.error });
    }
  }, [state, toast, router]);

  return (
    <form action={formAction} ref={formRef} className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-6 pt-6 pb-10">
      <input type="hidden" name="projectId" value={projectId || ''} />

      <PageHeader>
        <PageHeaderHeading>
          <PageDescription>Instagram</PageDescription>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Newspaper className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Create post
            </span>
          </PageTitle>
          <PageDescription>Publish a single image with a caption to your connected account.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="ghost">
            <Link href="/dashboard/instagram/feed">
              <X className="h-4 w-4" aria-hidden="true" />
              Cancel
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <Card variant="elevated">
        <CardBody className="flex flex-col gap-5">
          <Field label="Image" required help="The image must be publicly accessible to Instagram.">
            <SabFileUrlInput
              id="imageUrl"
              name="imageUrl"
              accept="image"
              placeholder="Pick from your library or upload"
              value={imageUrl}
              onChange={setImageUrl}
            />
          </Field>

          {imageUrl ? (
            <div className="overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]">
              <div className="relative aspect-square w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Selected post preview" className="h-full w-full object-cover" />
              </div>
            </div>
          ) : null}

          <Field label="Caption" help={`${caption.length} characters`}>
            <Textarea
              id="caption"
              name="caption"
              placeholder="Write a caption for this post"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-40"
            />
          </Field>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/instagram/feed">Discard</Link>
        </Button>
        <SubmitButton disabled={!projectId || !imageUrl} />
      </div>
    </form>
  );
}
