
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function BulkCreateQrDialog() {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" />
            Bulk Create
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk QR Code Creation</DialogTitle>
            <DialogDescription>
              Create multiple QR codes at once by uploading a file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Alert>
              <AlertTitle>Coming Soon!</AlertTitle>
              <AlertDescription>
                This feature is under development and will be available in a future update.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
