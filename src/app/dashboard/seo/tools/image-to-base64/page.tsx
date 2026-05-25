'use client';

import { Button, Card, ZoruCardContent, Input, Label, Textarea } from '@/components/zoruui';
import { useState, useRef, useEffect } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageToBase64Page() {
  const [mode, setMode] = useState<'i2b' | 'b2i'>('i2b');

  // i2b state
  const [b64, setB64] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [i2bPreviewSrc, setI2bPreviewSrc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // b2i state
  const [b2iErr, setB2iErr] = useState('');
  const [b2iImageSrc, setB2iImageSrc] = useState('');
  const [b2iFull, setB2iFull] = useState('');
  const [b2iDisplay, setB2iDisplay] = useState('');
  const [isB2iConverting, setIsB2iConverting] = useState(false);

  useEffect(() => {
    return () => {
      if (i2bPreviewSrc) URL.revokeObjectURL(i2bPreviewSrc);
      if (b2iImageSrc && b2iImageSrc.startsWith('blob:')) URL.revokeObjectURL(b2iImageSrc);
    };
  }, [i2bPreviewSrc, b2iImageSrc]);

  function onFile(f: File | null) {
    setErr('');
    setB64('');
    setCopied(false);
    if (i2bPreviewSrc) URL.revokeObjectURL(i2bPreviewSrc);
    setI2bPreviewSrc('');
    
    if (!f) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (f.size > 10 * 1024 * 1024) { // 10MB limit
      setErr('File is too large (max 10MB). Converting larger files may freeze your browser.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    setI2bPreviewSrc(URL.createObjectURL(f));
    
    const reader = new FileReader();
    reader.onload = () => setB64(String(reader.result || ''));
    reader.onerror = () => setErr('Failed to read file');
    reader.readAsDataURL(f);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(b64).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setErr('Failed to copy to clipboard');
    });
  };

  const handleB2iChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setB2iFull(val);
    if (val.length > 2000) {
      setB2iDisplay(val.slice(0, 2000) + '\n\n... [truncated for display, full string stored in memory]');
    } else {
      setB2iDisplay(val);
    }
  };

  const handleB2iPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.length > 2000) {
      e.preventDefault();
      setB2iFull(text);
      setB2iDisplay(text.slice(0, 2000) + `

... [truncated for display, full string stored in memory]`);
    }
  };

  const handleB2iConvert = async () => {
    setB2iErr('');
    if (b2iImageSrc && b2iImageSrc.startsWith('blob:')) {
      URL.revokeObjectURL(b2iImageSrc);
    }
    setB2iImageSrc('');
    const val = b2iFull.trim();
    if (!val) {
      setB2iErr('Please paste a Base64 string');
      return;
    }
    
    let src = val;
    if (!src.startsWith('data:image/')) {
      // Default to png if no data URI scheme is provided
      src = `data:image/png;base64,${val}`;
    }
    
    setIsB2iConverting(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      setB2iImageSrc(URL.createObjectURL(blob));
    } catch (e) {
      setB2iErr('Invalid image base64 data.');
    } finally {
      setIsB2iConverting(false);
    }
  };

  const handleDownload = () => {
    if (!b2iImageSrc) return;
    const a = document.createElement('a');
    a.href = b2iImageSrc;
    a.download = 'converted-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const displayB64 = b64.length > 2000 
    ? b64.slice(0, 2000) + `

... [truncated for display, use Copy button to get full string]` 
    : b64;

  return (
    <ToolShell title="Image ↔ Base64 Converter" description="Convert an image to a base64 data URL, or decode a base64 string back to an image.">
      <div className="flex gap-2 mb-4">
        <Button 
          variant={mode === 'i2b' ? 'default' : 'outline'} 
          onClick={() => setMode('i2b')}
        >
          Image to Base64
        </Button>
        <Button 
          variant={mode === 'b2i' ? 'default' : 'outline'} 
          onClick={() => setMode('b2i')}
        >
          Base64 to Image
        </Button>
      </div>

      {mode === 'i2b' && (
        <Card>
          <ZoruCardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Image file</Label>
                {b64.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => onFile(null)} className="h-6 px-2 text-xs">
                    Clear
                  </Button>
                )}
              </div>
              <Input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                onChange={(e) => onFile(e.target.files?.[0] || null)} 
              />
            </div>
            {err && <div className="text-sm text-destructive">{err}</div>}
            {b64 && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label>Base64 Output</Label>
                  <div className="text-xs text-muted-foreground font-mono">
                    {b64.length.toLocaleString()} characters
                  </div>
                </div>
                <Textarea 
                  value={displayB64} 
                  readOnly 
                  className="min-h-[200px] font-mono text-xs resize-y" 
                />
                <Button onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy full string to clipboard'}
                </Button>
                {i2bPreviewSrc && (
                  <div className="space-y-2 pt-4">
                    <Label>Preview</Label>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i2bPreviewSrc} alt="Preview" className="max-w-full rounded border max-h-[400px] object-contain" />
                  </div>
                )}
              </div>
            )}
          </ZoruCardContent>
        </Card>
      )}

      {mode === 'b2i' && (
        <Card>
          <ZoruCardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Base64 String</Label>
                <div className="flex items-center gap-3">
                  {b2iFull.length > 0 && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {b2iFull.length.toLocaleString()} characters
                    </div>
                  )}
                  {b2iFull.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => { 
                        setB2iFull(''); 
                        setB2iDisplay(''); 
                        setB2iErr(''); 
                        setB2iImageSrc(''); 
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <Textarea 
                value={b2iDisplay}
                onChange={handleB2iChange}
                onPaste={handleB2iPaste}
                readOnly={b2iFull.length > 2000}
                placeholder="Paste your base64 string here..."
                className="min-h-[200px] font-mono text-xs resize-y" 
              />
            </div>
            {b2iErr && <div className="text-sm text-destructive">{b2iErr}</div>}
            
            <Button onClick={handleB2iConvert} disabled={isB2iConverting || b2iFull.length === 0}>
              {isB2iConverting ? 'Converting...' : 'Convert to Image'}
            </Button>

            {b2iImageSrc && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Preview</Label>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={b2iImageSrc} 
                    alt="Converted Preview" 
                    className="max-w-full rounded border max-h-[400px] object-contain" 
                    onError={() => {
                      setB2iErr('Invalid image base64 data.');
                      setB2iImageSrc('');
                    }}
                  />
                </div>
                <Button variant="secondary" onClick={handleDownload}>
                  Download Image
                </Button>
              </div>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
