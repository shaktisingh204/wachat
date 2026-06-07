'use client';

import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import { Download } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function QrCodePage() {
  const { toast } = useToast();

  const [text, setText] = useState('https://sabnode.com');
  const [submitted, setSubmitted] = useState('');

  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [logoUrl, setLogoUrl] = useState('');
  const [format, setFormat] = useState('png');

  const wrapRef = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!wrapRef.current) return;

    try {
      // Use html2canvas to render the SVG and logo overlay to a canvas.
      // This avoids fragile direct DOM access like querySelector('svg').
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
      toast.success(`QR code downloaded as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Failed to generate image for download', err);
      toast.error('Could not generate the image for download');
    }
  };

  return (
    <ToolShell title="QR Code Generator" description="Generate a custom QR code locally (no third-party API).">
      <div className="flex max-w-2xl flex-col gap-6">
        <div className="flex items-end gap-2">
          <Field label="Text or URL" className="flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text or URL"
            />
          </Field>
          <Button variant="primary" onClick={() => setSubmitted(text)}>
            Generate
          </Button>
        </div>

        {submitted && (
          <Card variant="outlined" padding="lg" className="bg-[var(--st-bg-secondary)]">
            <CardBody className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Foreground">
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      aria-label="Foreground color swatch"
                      className="h-10 w-12 shrink-0 cursor-pointer p-1"
                    />
                    <Input
                      type="text"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      aria-label="Foreground color hex value"
                      className="flex-1 font-mono text-sm uppercase"
                    />
                  </div>
                </Field>

                <Field label="Background">
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      aria-label="Background color swatch"
                      className="h-10 w-12 shrink-0 cursor-pointer p-1"
                    />
                    <Input
                      type="text"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      aria-label="Background color hex value"
                      className="flex-1 font-mono text-sm uppercase"
                    />
                  </div>
                </Field>

                <Field label="Logo (optional)">
                  <SabFileUrlInput
                    value={logoUrl}
                    onChange={(value) => setLogoUrl(value)}
                    accept="image"
                    placeholder="Pick a logo image"
                    pickerTitle="Choose a logo"
                  />
                </Field>
              </div>

              <Card
                variant="elevated"
                padding="lg"
                className="flex w-full max-w-sm flex-col items-center gap-6 self-center"
              >
                <div
                  ref={wrapRef}
                  className="relative flex items-center justify-center rounded-[var(--st-radius)] p-4"
                  style={{ backgroundColor: bgColor }}
                >
                  <QRCode value={submitted} size={256} fgColor={fgColor} bgColor={bgColor} level="H" />
                  {logoUrl && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoUrl}
                        alt="Overlay logo"
                        crossOrigin="anonymous"
                        className="h-16 w-16 rounded-lg bg-white object-contain p-1.5 shadow-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="flex w-full items-center gap-3">
                  <div className="flex-1">
                    <Select value={format} onValueChange={setFormat}>
                      <SelectTrigger className="w-full" aria-label="Image format">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="webp">WebP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="primary" onClick={download} iconLeft={Download} className="flex-1">
                    Download
                  </Button>
                </div>
              </Card>
            </CardBody>
          </Card>
        )}
      </div>
    </ToolShell>
  );
}
