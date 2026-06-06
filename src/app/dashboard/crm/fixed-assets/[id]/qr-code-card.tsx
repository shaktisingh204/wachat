'use client';

import QRCode from 'react-qr-code';
import { Card, CardHeader, CardTitle, CardBody, Button } from '@/components/sabcrm/20ui/compat';
import { Printer } from 'lucide-react';

export function QrCodeCard({ value, code }: { value: string, code: string }) {
  const printQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR - ${code}</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
            .qr-container { padding: 20px; border: 1px dashed #ccc; text-align: center; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h3>Asset: ${code}</h3>
            <img src="\${document.getElementById('qr-svg-wrapper')?.querySelector('svg')?.outerHTML.replace(/"/g, "'")}" style="display:none;" />
            <div id="svg-placeholder"></div>
          </div>
          <script>
            // We'll pass the SVG content dynamically
          </script>
        </body>
      </html>
    `);
    
    const svgEl = document.getElementById('asset-qr-code')?.outerHTML;
    if (svgEl) {
      printWindow.document.getElementById('svg-placeholder')!.innerHTML = svgEl;
    }
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Asset QR Code</CardTitle>
        <Button size="sm" variant="ghost" onClick={printQR} title="Print Label">
          <Printer className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardBody className="flex flex-col items-center justify-center p-6">
        <div className="rounded-lg bg-white p-4 shadow-sm border border-[var(--st-border)]" id="qr-svg-wrapper">
          <QRCode id="asset-qr-code" value={value} size={150} level="H" />
        </div>
        <p className="mt-4 text-[12px] text-[var(--st-text-secondary)]">Scan to open asset in CRM</p>
      </CardBody>
    </Card>
  );
}
