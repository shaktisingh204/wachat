
'use client';

import { useState } from 'react';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function BulkCreateQrDialog() {
  const [open, setOpen] = useState(false);
  
  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Create
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Bulk QR Code Creation</ZoruDialogTitle>
            <ZoruDialogDescription>
              Create multiple QR codes at once by uploading a file.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-6">
            <Alert>
              <AlertTitle>Coming Soon!</AlertTitle>
              <AlertDescription>
                This feature is under development and will be available in a future update.
              </AlertDescription>
            </Alert>
          </div>
          <ZoruDialogFooter>
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Close</ZoruButton>
          </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
