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
import { LoaderCircle, UploadCloud } from 'lucide-react';
import Link from 'next/link';

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

function ChunkedFileUploader({ onUploadSuccess }: { onUploadSuccess: (url: string, file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);
    const chunkSize = 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const fileId = Date.now().toString() + '_' + Math.random().toString(36).substring(7);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkIndex', i.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('filename', file.name);
      formData.append('fileId', fileId);

      try {
        const res = await fetch('/dashboard/crm/files/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.url) {
          onUploadSuccess(data.url, file);
        }
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      } catch (err) {
        console.error('Upload failed', err);
        setUploading(false);
        return;
      }
    }
    setUploading(false);
  };

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-zoru-line bg-zoru-surface'
      }`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={handleChange} disabled={uploading} />
      <UploadCloud className="mx-auto mb-4 h-10 w-10 text-zoru-ink-muted" />
      {uploading ? (
        <div>
          <p className="mb-2 text-sm font-medium text-zoru-ink">Uploading... {progress}%</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zoru-surface-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-zoru-ink">Drag and drop file here</p>
          <p className="mt-1 text-xs text-zoru-ink-muted">or click to browse</p>
        </div>
      )}
    </div>
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
            <Label>File Upload (Drag & Drop)</Label>
            <ChunkedFileUploader
              onUploadSuccess={(uploadedUrl, file) => {
                setUrl(uploadedUrl);
                const filenameInput = document.getElementById('filename') as HTMLInputElement;
                if (filenameInput) filenameInput.value = file.name;
                
                const sizeInput = document.getElementById('size_bytes') as HTMLInputElement;
                if (sizeInput) sizeInput.value = file.size.toString();
                
                const mimeInput = document.getElementById('mime_type') as HTMLInputElement;
                if (mimeInput) mimeInput.value = file.type || '';
                
                const extInput = document.getElementById('extension') as HTMLInputElement;
                const extMatch = file.name.match(/\.([^.]+)$/);
                if (extInput && extMatch) extInput.value = extMatch[1];
              }}
            />
            <input type="hidden" name="url" value={url} />
            <p className="text-[11.5px] text-zoru-ink-muted">
              Drop a file to upload or click to browse.
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
