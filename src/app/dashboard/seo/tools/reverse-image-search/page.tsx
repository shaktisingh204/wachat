'use client';

import { Button, Input, Card, CardBody, cn } from '@/components/sabcrm/20ui';
import { cn as _zoruCn, useState, useRef } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ReverseImageSearchPage() {
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const links = submitted
    ? [
        { name: 'Google Lens', href: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(submitted)}` },
        { name: 'TinEye', href: `https://tineye.com/search?url=${encodeURIComponent(submitted)}` },
        { name: 'Yandex', href: `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(submitted)}` },
        { name: 'Bing Visual', href: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encodeURIComponent(submitted)}` },
      ]
    : [];

  const handleSearchUrl = () => {
    if (!url.trim()) return;
    setPreview(url);
    setSubmitted(url);
    setError('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    setSubmitted('');
    setUploading(true);
    setError('');
    setUrl(''); // Clear URL input when a file is uploaded

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'success') {
        const directUrl = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        setSubmitted(directUrl);
      } else {
        setError('Failed to upload image. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ToolShell title="Reverse Image Search" description="Search for an image across multiple reverse-image engines.">
      <div className="flex flex-col gap-6">
        
        <Card>
          <CardBody className="p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Image URL</label>
              <div className="flex gap-2">
                <Input 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)} 
                  placeholder="https://example.com/image.jpg" 
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUrl()}
                />
                <Button onClick={handleSearchUrl}>Search</Button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="h-px bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] flex-1"></div>
              <span className="text-sm text-[var(--st-text)] font-medium">OR</span>
              <div className="h-px bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)] flex-1"></div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Upload Image (Max 5MB)</label>
              <div className="flex gap-2 items-center">
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Choose File'}
                </Button>
                <span className="text-sm text-[var(--st-text)]">
                  {fileInputRef.current?.files?.[0]?.name || 'No file chosen'}
                </span>
                <Input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="hidden"
                />
              </div>
              {error && <p className="text-sm text-[var(--st-text)] mt-1">{error}</p>}
            </div>
          </CardBody>
        </Card>

        {preview && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">Image Preview</h3>
            <div className="rounded-md border border-[var(--st-border)] dark:border-[var(--st-border)] p-2 max-w-sm">
              <img 
                src={preview} 
                alt="Search preview" 
                className="w-full h-auto rounded object-contain max-h-64"
                onError={() => setError('Failed to load image preview.')}
              />
            </div>
          </div>
        )}

        {links.length > 0 && (
          <Card>
            <CardBody className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--st-text)] dark:text-[var(--st-text-secondary)] border-b pb-2 mb-2">Search Engines</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {links.map((l) => (
                  <a 
                    key={l.name} 
                    className="flex items-center gap-2 p-3 rounded-md border border-[var(--st-border)] dark:border-[var(--st-border)] hover:bg-[var(--st-bg-muted)] dark:hover:bg-[var(--st-text)] transition-colors" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    href={l.href}
                  >
                    <span className="text-lg">🔗</span> 
                    <span className="text-sm font-medium text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">Search on {l.name}</span>
                  </a>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </ToolShell>
  );
}
