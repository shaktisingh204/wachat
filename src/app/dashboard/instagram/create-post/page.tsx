'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, Input, Label, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createInstagramImagePost } from '@/app/actions/instagram.actions';

import { SabFileUrlInput } from '@/components/sabfiles';
import { LoaderCircle, X, Instagram } from 'lucide-react';

const initialState: any = { message: null, error: null };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="sm" disabled={pending || disabled}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Post
    </ZoruButton>
  );
}

export default function CreateInstagramPostPage() {
  const [state, formAction] = useActionState(createInstagramImagePost, initialState);
  const { toast } = useZoruToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const storedProjectId = localStorage.getItem('activeProjectId');
    setProjectId(storedProjectId);
  }, []);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message });
      formRef.current?.reset();
      setImageUrl('');
      router.push('/dashboard/instagram/feed');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex justify-center">
      <form action={formAction} ref={formRef} className="w-full max-w-xl">
        <input type="hidden" name="projectId" value={projectId || ''} />
        <ZoruCard className="p-0">
          <ZoruCardHeader className="flex flex-row items-center justify-between">
            <ZoruButton variant="ghost" size="icon" asChild>
              <Link href="/dashboard/instagram/feed">
                <X className="h-5 w-5" />
              </Link>
            </ZoruButton>
            <h1 className="text-lg flex items-center gap-2 text-zoru-ink">
              <Instagram className="h-5 w-5" /> Create Post
            </h1>
            <SubmitButton disabled={!projectId} />
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <div className="space-y-2">
              <ZoruLabel htmlFor="imageUrl">Image URL</ZoruLabel>
              <SabFileUrlInput
                id="imageUrl"
                name="imageUrl"
                accept="image"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={setImageUrl}
              />
              <p className="text-xs text-zoru-ink-muted">
                Your image must be publicly accessible.
              </p>
            </div>
            <div className="space-y-2">
              <ZoruLabel htmlFor="caption">Caption</ZoruLabel>
              <ZoruTextarea
                id="caption"
                name="caption"
                placeholder="Write a caption..."
                className="min-h-48"
              />
            </div>
          </ZoruCardContent>
        </ZoruCard>
      </form>
    </div>
  );
}
