'use client';

import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast, Checkbox, FileUploadCard, type FileUploadItem } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  useRef
} from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import {
  saveFile,
  getFileFolders,
} from '@/app/actions/worksuite/files.actions';
import type { WsFileFolder } from '@/lib/worksuite/file-types';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Save file record
    </Button>
  );
}

function ChunkedFileUploader({ onUploadSuccess }: { onUploadSuccess: (url: string, file: File) => void }) {
  const [items, setItems] = useState<FileUploadItem[]>([]);

  const uploadFile = async (item: FileUploadItem) => {
    const file = item.file;
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
        
        const currentProgress = Math.round(((i + 1) / totalChunks) * 100);
        setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, progress: currentProgress } : p));
        
        if (data.url) {
          setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, status: 'done', progress: 100 } : p));
          onUploadSuccess(data.url, file);
        }
      } catch (err) {
        console.error('Upload failed', err);
        setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, status: 'error', errorMessage: 'Upload failed' } : p));
        return;
      }
    }
  };

  const handleFilesSelected = (files: File[]) => {
    const newItems: FileUploadItem[] = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'uploading'
    }));
    
    // We only support single file for this form
    setItems(newItems);
    
    // Start upload
    newItems.forEach(uploadFile);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <FileUploadCard
      multiple={false}
      hint="Drag and drop a file or click to browse"
      onFilesSelected={handleFilesSelected}
      items={items}
      onRemove={handleRemove}
    />
  );
}

export default function NewFileRecordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction] = useActionState(saveFile, initialState);
  const [folders, setFolders] = useState<WsFileFolder[]>([]);
  const [url, setUrl] = useState('');
  const [_, startTransition] = useTransition();

  const formRef = useRef<HTMLFormElement>(null);

  useGSAP(() => {
    gsap.fromTo(
      formRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
  }, { scope: formRef });

  useEffect(() => {
    startTransition(async () => {
      try {
        const f = await getFileFolders();
        setFolders(f as unknown as WsFileFolder[]);
      } catch (e) {
        console.error('Failed to load folders', e);
      }
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
        <form ref={formRef} action={formAction} className="space-y-5">
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
            <Checkbox id="is_public" name="is_public" />
            <Label htmlFor="is_public" className="cursor-pointer">
              Publicly accessible
            </Label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--st-border)] pt-4">
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
