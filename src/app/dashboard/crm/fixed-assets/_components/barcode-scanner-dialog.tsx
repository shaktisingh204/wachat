'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, DialogDescription } from '@/components/sabcrm/20ui';
import { ScanBarcode } from 'lucide-react';

export function BarcodeScannerDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const router = useRouter();

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    
    // If it looks like a 24-char hex ObjectId, we can go directly to the asset page
    if (/^[0-9a-fA-F]{24}$/.test(code)) {
      router.push(`/dashboard/crm/fixed-assets/${code}`);
    } else {
      // Otherwise, search by asset code
      router.push(`/dashboard/crm/fixed-assets?q=${encodeURIComponent(code)}`);
    }
    setOpen(false);
    setCode('');
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ScanBarcode className="mr-2 h-4 w-4" /> Scan Asset
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan Asset Barcode</DialogTitle>
            <DialogDescription>
              Use a barcode scanner or enter the asset code manually.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleScan} className="flex flex-col gap-4">
            <Input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Asset ID or Code..."
            />
            <Button type="submit">Lookup</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
