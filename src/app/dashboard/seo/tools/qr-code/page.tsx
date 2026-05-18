'use client';

import { ZoruButton, ZoruInput, cn } from '@/components/zoruui';
import { cn as _zoruCn, useRef, useState } from 'react';
import QRCode from 'react-qr-code';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function QrCodePage() {
  const [text, setText] = useState('https://example.com');
  const [submitted, setSubmitted] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const download = () => {
    const svg = wrapRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'qr.svg';
    a.click();
  };

  return (
    <ToolShell title="QR Code Generator" description="Generate a QR code locally (no third-party API).">
      <div className="flex gap-2">
        <ZoruInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Text or URL" />
        <ZoruButton onClick={() => setSubmitted(text)}>Generate</ZoruButton>
      </div>
      {submitted && (
        <div className="flex flex-col items-start gap-2">
          <div ref={wrapRef} className="p-4 bg-white border rounded">
            <QRCode value={submitted} size={256} />
          </div>
          <ZoruButton variant="outline" onClick={download}>Download SVG</ZoruButton>
        </div>
      )}
    </ToolShell>
  );
}
