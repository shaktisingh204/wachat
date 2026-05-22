'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';

import { SabFileUrlInput } from '@/components/sabfiles';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import {
  saveFile,
  getFileFolders,
} from '@/app/actions/worksuite/files.actions';
import type { WsFileFolder } from '@/lib/worksuite/file-types';

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      Save file record
    </Button>
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
    <EntityDetailShell
      eyebrow="FILES"
      title="Attach a file"
      back={{ href: '/dashboard/crm/files', label: 'Files' }}
    >

      <Card className="p-6">
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

          <div className="flex items-center justify-end gap-3 border-t border-zoru-line pt-4">
            <Link href="/dashboard/crm/files">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <SubmitBtn />
          </div>
        </form>
      </Card>
    </EntityDetailShell>
  );
}
