'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
} from '@/components/sabcrm/20ui/compat';
import {
  useState } from 'react';

import { Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function BulkCreateQrDialog() {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Create
        </Button>
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
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}
