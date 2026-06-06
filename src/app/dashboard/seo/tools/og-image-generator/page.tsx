'use client';

import {
  Button,
  Field,
  Textarea,
  ColorPicker,
  SegmentedControl,
  Card,
  CardBody,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { useRef, useState, useEffect } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { X } from 'lucide-react';

export default function OgImageGeneratorPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState('Launch your brand on every share');
  const [subtitle, setSubtitle] = useState('A crisp 1200x630 social preview in seconds');
  const [bgMode, setBgMode] = useState<'color' | 'image'>('color');
  const [bgColor, setBgColor] = useState('#0f172a');
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [textColor, setTextColor] = useState('#ffffff');
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      // Keep the canvas untainted so toBlob() works when downloading.
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = url;
    });

  const handleBgImagePick = async (pick: SabFilePick) => {
    try {
      const img = await loadImage(pick.url);
      setBgImage(img);
      setBgMode('image');
    } catch {
      toast.error('Could not load that background image.');
    }
  };

  const handleLogoPick = async (pick: SabFilePick) => {
    try {
      const img = await loadImage(pick.url);
      setLogoImage(img);
    } catch {
      toast.error('Could not load that logo image.');
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
      if (!blob) {
        toast.error('Could not export the image.');
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'og-image.png';
      a.click();
    });
  };

  return (
    <ToolShell title="OG Image Generator" description="Generate an Open Graph share image (1200x630).">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Field label="Title">
            <Textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
            />
          </Field>
          <Field label="Subtitle">
            <Textarea
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              rows={2}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Background Type">
              <SegmentedControl<'color' | 'image'>
                aria-label="Background type"
                value={bgMode}
                onChange={setBgMode}
                items={[
                  { value: 'color', label: 'Color' },
                  { value: 'image', label: 'Image' },
                ]}
              />
            </Field>

            <Field label="Text Color">
              <ColorPicker value={textColor} onChange={setTextColor} />
            </Field>
          </div>

          {bgMode === 'color' ? (
            <Field label="Background Color">
              <ColorPicker value={bgColor} onChange={setBgColor} />
            </Field>
          ) : (
            <Field label="Background Image">
              <SabFilePickerButton accept="image" onPick={handleBgImagePick}>
                {bgImage ? 'Replace background image' : 'Choose background image'}
              </SabFilePickerButton>
            </Field>
          )}

          <Field label="Brand Logo / Watermark">
            <div className="flex items-center gap-2">
              <SabFilePickerButton accept="image" onPick={handleLogoPick}>
                {logoImage ? 'Replace logo' : 'Choose logo'}
              </SabFilePickerButton>
              {logoImage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={X}
                  onClick={() => setLogoImage(null)}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </Field>
        </div>

        <div className="space-y-4">
          <Field label="Preview">
            <Card variant="outlined" padding="sm">
              <CardBody>
                <canvas
                  ref={canvasRef}
                  className="max-w-full rounded-[var(--st-radius)] shadow-sm bg-white aspect-[1200/630]"
                />
              </CardBody>
            </Card>
          </Field>
          <Button block onClick={download}>Download PNG</Button>
        </div>
      </div>
    </ToolShell>
  );
}
