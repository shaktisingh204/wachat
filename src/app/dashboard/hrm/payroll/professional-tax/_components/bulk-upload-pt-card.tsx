'use client';

import {
  Button,
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { Upload, LoaderCircle } from 'lucide-react';
import { importProfessionalTaxRecordsCsv } from '@/app/actions/crm-professional-tax.actions';
import { useRouter } from 'next/navigation';

export function BulkUploadPtCard() {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useZoruToast();
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const text = await file.text();
      
      const res = await importProfessionalTaxRecordsCsv({
        csv: text,
      });

      if (res.success) {
        toast({
          title: 'Import complete',
          description: `Successfully imported ${res.imported} records. Skipped ${res.skipped} rows. Errors: ${res.errors.length}.`,
        });
        if (res.imported > 0) {
            router.push('/dashboard/hrm/payroll/professional-tax');
        }
      } else {
        toast({
          title: 'Import failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error reading file',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Bulk Upload (CSV)</ZoruCardTitle>
        <ZoruCardDescription>
          Upload a CSV file containing multiple Professional Tax records.
          Required columns: employeeName, state, month (YYYY-MM).
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={() => document.getElementById('csv-upload')?.click()}
          >
            {isUploading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading ? 'Uploading...' : 'Select CSV file'}
          </Button>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </ZoruCardContent>
    </Card>
  );
}
