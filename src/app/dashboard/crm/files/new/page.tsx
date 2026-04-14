'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, FileText, LoaderCircle } from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
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
import { CrmPageHeader } from '../../_components/crm-page-header';

import {
  saveFile,
  getFileFolders,
} from '@/app/actions/worksuite/files.actions';
import type { WsFileFolder } from '@/lib/worksuite/file-types';

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <ClayButton
      type="submit"
      variant="obsidian"
      size="lg"
      disabled={pending}
      leading={
        pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined
      }
    >
      Save file record
    </ClayButton>
  );
}

export default function NewFileRecordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction] = useActionState(saveFile, initialState);
  const [folders, setFolders] = useState<WsFileFolder[]>([]);
  const [_, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const f = await getFileFolders();
      setFolders(f as unknown as WsFileFolder[]);
    });
  }, []);

  useEffect(() => {
    if (state.message) {
      toast({ title: state.message });
      router.push('/dashboard/crm/files');
    } else if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: state.error,
      });
    }
  }, [state, router, toast]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/dashboard/crm/files"
        className="inline-flex items-center gap-2 text-[12.5px] text-clay-ink-muted hover:text-clay-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to files
      </Link>

      <CrmPageHeader
        title="Attach a file"
        subtitle="SabNode stores file metadata only — upload the binary to your own storage, then paste the URL below."
        icon={FileText}
      />

      <ClayCard>
        <form action={formAction} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="filename">Filename *</Label>
              <Input
                id="filename"
                name="filename"
                required
                placeholder="contract.pdf"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                name="display_name"
                placeholder="Signed contract"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="url">File URL *</Label>
            <Input
              id="url"
              name="url"
              type="url"
              required
              placeholder="https://..."
            />
            <p className="text-[11.5px] text-clay-ink-muted">
              Paste the public URL where the file is hosted.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="size_bytes">Size (bytes)</Label>
              <Input id="size_bytes" name="size_bytes" type="number" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mime_type">MIME type</Label>
              <Input
                id="mime_type"
                name="mime_type"
                placeholder="application/pdf"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extension">Extension</Label>
              <Input id="extension" name="extension" placeholder="pdf" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="folder_id">Folder</Label>
              <Select name="folder_id">
                <SelectTrigger>
                  <SelectValue placeholder="No folder (root)" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((f) => (
                    <SelectItem key={String(f._id)} value={String(f._id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="storage_location">Storage location</Label>
              <Input
                id="storage_location"
                name="storage_location"
                defaultValue="external"
                placeholder="external / firebase / s3"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional notes about this file..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_public"
              name="is_public"
              className="h-4 w-4"
            />
            <Label htmlFor="is_public" className="cursor-pointer">
              Publicly accessible
            </Label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-clay-border pt-4">
            <Link href="/dashboard/crm/files">
              <ClayButton variant="ghost">Cancel</ClayButton>
            </Link>
            <SubmitBtn />
          </div>
        </form>
      </ClayCard>
    </div>
  );
}
