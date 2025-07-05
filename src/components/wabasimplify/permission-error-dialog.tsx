
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { FacebookEmbeddedSignup } from './facebook-embedded-signup';
import type { WithId, Project } from '@/lib/definitions';

interface PermissionErrorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  project: WithId<Project> | null;
  onSuccess: () => void;
}

export function PermissionErrorDialog({ isOpen, onOpenChange, error, project, onSuccess }: PermissionErrorDialogProps) {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID; 

  if (!project || !appId || !configId) {
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
            <FacebookEmbeddedSignup
              appId={appId}
              onSuccess={onSuccess}
              configId={configId}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
