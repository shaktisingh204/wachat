'use client';

import { Button, Input, Label, Textarea } from '@/components/zoruui';
import { useRef, useState, useEffect } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function OgImageGeneratorPage() {
  const [title, setTitle] = useState('Your Title Here');
  const [subtitle, setSubtitle] = useState('Optional subtitle');
  const [bgMode, setBgMode] = useState<'color' | 'image'>('color');
  const [bgColor, setBgColor] = useState('#0f172a');
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [textColor, setTextColor] = useState('#ffffff');
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setBgImage(img);
        setBgMode('image');
      };
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setLogoImage(img);
      };
    }
  };

  const getLines = (ctx: CanvasRenderingContext2D, text: string, maxW: number) => {
    if (!text) return [];
    const rawLines = text.split('\n');
    const finalLines: string[] = [];

    for (const rawLine of rawLines) {
      if (!rawLine.trim()) {
        finalLines.push('');
        continue;
      }
      const words = rawLine.split(' ');
      let currentLine = words[0];
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxW) {
          currentLine += ' ' + word;
        } else {
          finalLines.push(currentLine);
          currentLine = word;
        }
      }
      finalLines.push(currentLine);
    }
    return finalLines;
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 630;

    // Draw Background
    if (bgMode === 'image' && bgImage) {
      const scale = Math.max(1200 / bgImage.width, 630 / bgImage.height);
      const w = bgImage.width * scale;
      const h = bgImage.height * scale;
      const x = (1200 - w) / 2;
      const y = (630 - h) / 2;
      ctx.drawImage(bgImage, x, y, w, h);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 1200, 630);
    }

    // Measure Text
    const titleFont = 'bold 72px sans-serif';
    const subtitleFont = '32px sans-serif';

    ctx.textBaseline = 'top';
    ctx.font = titleFont;
    const titleLines = getLines(ctx, title, 1040);

    ctx.font = subtitleFont;
    const subtitleLines = getLines(ctx, subtitle, 1040);

    const titleLineHeight = 88;
    const subtitleLineHeight = 42;
    const gap = subtitle.trim() ? 24 : 0;

    const activeTitleLines = titleLines.length;
    const activeSubtitleLines = subtitle.trim() ? subtitleLines.length : 0;

    const totalHeight = (activeTitleLines * titleLineHeight) + gap + (activeSubtitleLines * subtitleLineHeight);

    // Vertical Centering
    let startY = (630 - totalHeight) / 2;
    if (startY < 80) startY = 80;

    // Draw Text
    ctx.fillStyle = textColor;

    ctx.font = titleFont;
    titleLines.forEach((line, i) => {
      if (line) ctx.fillText(line, 80, startY + i * titleLineHeight);
    });

    let currentY = startY + activeTitleLines * titleLineHeight + gap;

    if (subtitle.trim()) {
      ctx.font = subtitleFont;
      subtitleLines.forEach((line, i) => {
        if (line) ctx.fillText(line, 80, currentY + i * subtitleLineHeight);
      });
    }

    // Draw Logo Watermark
    if (logoImage) {
      const maxWidth = 240;
      const maxHeight = 120;
      let w = logoImage.width;
      let h = logoImage.height;
      if (w > maxWidth || h > maxHeight) {
        const scale = Math.min(maxWidth / w, maxHeight / h);
        w *= scale;
        h *= scale;
      }
      ctx.drawImage(logoImage, 1200 - w - 60, 630 - h - 60, w, h);
    }
  };

  useEffect(() => {
    render();
  }, [title, subtitle, bgMode, bgColor, bgImage, textColor, logoImage]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'og-image.png';
      a.click();
    });
  };

  return (
    <ToolShell title="OG Image Generator" description="Generate an Open Graph share image (1200×630).">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Title</Label>
            <Textarea 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              rows={2}
            />
          </div>
          <div className="space-y-1">
            <Label>Subtitle</Label>
            <Textarea 
              value={subtitle} 
              onChange={(e) => setSubtitle(e.target.value)} 
              rows={2}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Background Type</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button 
                  variant={bgMode === 'color' ? 'default' : 'outline'} 
                  onClick={() => setBgMode('color')}
                  size="sm"
                >
                  Color
                </Button>
                <Button 
                  variant={bgMode === 'image' ? 'default' : 'outline'} 
                  onClick={() => setBgMode('image')}
                  size="sm"
                >
                  Image
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Text Color</Label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={textColor} 
                  onChange={(e) => setTextColor(e.target.value)} 
                  className="h-9 w-16 cursor-pointer" 
                />
              </div>
            </div>
          </div>

          {bgMode === 'color' ? (
            <div className="space-y-1">
              <Label>Background Color</Label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={bgColor} 
                  onChange={(e) => setBgColor(e.target.value)} 
                  className="h-9 w-16 cursor-pointer" 
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Upload Background Image</Label>
              <Input type="file" accept="image/*" onChange={handleBgImageUpload} />
            </div>
          )}

          <div className="space-y-1">
            <Label>Brand Logo / Watermark</Label>
            <Input type="file" accept="image/*" onChange={handleLogoUpload} />
            {logoImage && (
              <Button variant="ghost" size="sm" onClick={() => setLogoImage(null)} className="mt-1">
                Remove Logo
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Label>Preview</Label>
          <div className="border rounded bg-muted/20 p-2">
            <canvas 
              ref={canvasRef} 
              className="max-w-full rounded shadow-sm bg-white" 
              style={{ aspectRatio: '1200/630' }} 
            />
          </div>
          <Button className="w-full" onClick={download}>Download PNG</Button>
        </div>
      </div>
    </ToolShell>
  );
}
