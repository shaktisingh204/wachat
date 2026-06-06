'use client';

import { Button, Input, cn } from '@/components/sabcrm/20ui/compat';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';
import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function QrCodePage() {
  const [text, setText] = useState('https://example.com');
  const [submitted, setSubmitted] = useState('');
  
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [logoUrl, setLogoUrl] = useState('');
  const [format, setFormat] = useState('png');

  const wrapRef = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!wrapRef.current) return;

    try {
      // Use html2canvas to render the SVG and logo overlay to a canvas
      // This avoids fragile direct DOM access like querySelector('svg')
      const canvas = await html2canvas(wrapRef.current, {
        backgroundColor: bgColor,
        useCORS: true,
        scale: 2, // High resolution
      });
      
      const dataUrl = canvas.toDataURL(`image/${format}`);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-code.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to generate image for download', err);
    }
  };

  return (
    <ToolShell title="QR Code Generator" description="Generate a custom QR code locally (no third-party API).">
      <div className="flex flex-col gap-6 max-w-2xl">
        <div className="flex gap-2">
          <Input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Enter text or URL" 
            className="flex-1"
          />
          <Button onClick={() => setSubmitted(text)}>Generate</Button>
        </div>

        {submitted && (
          <div className="flex flex-col gap-6 p-6 border border-[var(--st-border)] rounded-xl bg-[var(--st-bg-muted)] mt-2 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--st-text)]">Foreground</label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="color" 
                    value={fgColor} 
                    onChange={(e) => setFgColor(e.target.value)} 
                    className="w-12 h-10 p-1 cursor-pointer shrink-0" 
                  />
                  <Input 
                    type="text" 
                    value={fgColor} 
                    onChange={(e) => setFgColor(e.target.value)} 
                    className="flex-1 font-mono text-sm uppercase" 
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--st-text)]">Background</label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="color" 
                    value={bgColor} 
                    onChange={(e) => setBgColor(e.target.value)} 
                    className="w-12 h-10 p-1 cursor-pointer shrink-0" 
                  />
                  <Input 
                    type="text" 
                    value={bgColor} 
                    onChange={(e) => setBgColor(e.target.value)} 
                    className="flex-1 font-mono text-sm uppercase" 
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--st-text)]">Logo URL (Optional)</label>
                <Input 
                  type="url" 
                  value={logoUrl} 
                  onChange={(e) => setLogoUrl(e.target.value)} 
                  placeholder="https://example.com/logo.png" 
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-6 p-6 bg-[var(--st-bg)] border border-[var(--st-border)] rounded-xl shadow-[var(--st-shadow-sm)] self-center w-full max-w-sm">
              <div 
                ref={wrapRef} 
                className="relative flex items-center justify-center rounded-md" 
                style={{ backgroundColor: bgColor, padding: '16px' }}
              >
                <QRCode 
                  value={submitted} 
                  size={256} 
                  fgColor={fgColor} 
                  bgColor={bgColor} 
                  level="H" 
                />
                {logoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={logoUrl} 
                      alt="Overlay Logo" 
                      crossOrigin="anonymous"
                      className="w-16 h-16 object-contain bg-white rounded-lg p-1.5 shadow-sm" 
                    />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1">
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger className="w-full bg-[var(--st-bg)]">
                      <SelectValue placeholder="Format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="webp">WebP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={download} className="flex-1">Download</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
