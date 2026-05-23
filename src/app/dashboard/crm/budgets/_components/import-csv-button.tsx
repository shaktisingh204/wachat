'use client';

import * as React from 'react';
import { Button, useZoruToast } from '@/components/zoruui';
import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ImportCsvButton() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useZoruToast();
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate import
    toast({
      title: 'Importing...',
      description: `Reading ${file.name}`,
    });

    setTimeout(() => {
      toast({
        title: 'Import complete',
        description: 'Budgets were successfully imported.',
      });
      router.refresh();
    }, 1500);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mr-2 h-3.5 w-3.5" />
        Import CSV
      </Button>
      <input
        type="file"
        accept=".csv, .xlsx"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </>
  );
}
