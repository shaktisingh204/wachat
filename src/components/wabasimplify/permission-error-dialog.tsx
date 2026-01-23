
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Facebook } from 'lucide-react';
import type { WithId, Project } from '@/lib/definitions';
import { FacebookIcon } from './custom-sidebar-components';
import { Button } from '../ui/button';

interface PermissionErrorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  project: WithId<Project> | null;
  onSuccess: () => void;
}

export function PermissionErrorDialog({ isOpen, onOpenChange, error, project, onSuccess }: PermissionErrorDialogProps) {

  if (!project) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="text-destructive h-6 w-6" />
            Permissions Required
          </DialogTitle>
          <DialogDescription>
            SabNode needs additional permissions to access this feature.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground">
            To fix this, please reconnect your Facebook account and ensure you grant all requested permissions. Your existing settings will be preserved.
          </p>
          <div className="flex justify-center">
             <Button asChild size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
                <a href={`/api/auth/meta-suite/login?reauthorize=true&state=facebook_reauth`}>
                    <FacebookIcon className="mr-2 h-5 w-5" />
                    Re-authorize with Facebook
                </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
