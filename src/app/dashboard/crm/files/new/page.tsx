'use client';

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
import {
  useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  FileText,
  LoaderCircle } from 'lucide-react';

import { SabFileUrlInput } from '@/components/sabfiles';
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
    <ZoruButton type="submit" size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      Save file record
    </ZoruButton>
  );
}

export default function NewFileRecordPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(saveFile, initialState);
  const [folders, setFolders] = useState<WsFileFolder[]>([]);
  const [url, setUrl] = useState('');
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
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/dashboard/crm/files"
        className="inline-flex items-center gap-2 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to files
      </Link>

      <CrmPageHeader
        title="Attach a file"
        subtitle="SabNode stores file metadata only — upload the binary to your own storage, then paste the URL below."
        icon={FileText}
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="filename">Filename *</ZoruLabel>
              <ZoruInput
                id="filename"
                name="filename"
                required
                placeholder="contract.pdf"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="display_name">Display name</ZoruLabel>
              <ZoruInput
                id="display_name"
                name="display_name"
                placeholder="Signed contract"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="url">File URL *</ZoruLabel>
            <SabFileUrlInput
              id="url"
              name="url"
              value={url}
              onChange={(v) => setUrl(v)}
              accept="all"
              placeholder="https://..."
            />
            <p className="text-[11.5px] text-zoru-ink-muted">
              Paste the public URL where the file is hosted.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="size_bytes">Size (bytes)</ZoruLabel>
              <ZoruInput id="size_bytes" name="size_bytes" type="number" min={0} />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="mime_type">MIME type</ZoruLabel>
              <ZoruInput
                id="mime_type"
                name="mime_type"
                placeholder="application/pdf"
              />
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="extension">Extension</ZoruLabel>
              <ZoruInput id="extension" name="extension" placeholder="pdf" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="folder_id">Folder</ZoruLabel>
              <ZoruSelect name="folder_id">
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="No folder (root)" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {folders.map((f) => (
                    <ZoruSelectItem key={String(f._id)} value={String(f._id)}>
                      {f.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="storage_location">Storage location</ZoruLabel>
              <ZoruInput
                id="storage_location"
                name="storage_location"
                defaultValue="external"
                placeholder="external / firebase / s3"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
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
            <ZoruLabel htmlFor="is_public" className="cursor-pointer">
              Publicly accessible
            </ZoruLabel>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zoru-line pt-4">
            <Link href="/dashboard/crm/files">
              <ZoruButton variant="ghost">Cancel</ZoruButton>
            </Link>
            <SubmitBtn />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
