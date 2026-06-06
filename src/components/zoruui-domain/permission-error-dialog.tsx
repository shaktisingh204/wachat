'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
} from '@/components/sabcrm/20ui/compat';
import { AlertCircle, Facebook } from 'lucide-react';
import type { WithId,
  Project } from '@/lib/definitions';
import { FacebookIcon } from './custom-sidebar-components';

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
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle className="flex items-center gap-2">
            <AlertCircle className="text-zoru-ink h-6 w-6" />
            Permissions Required
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            SabNode needs additional permissions to access this feature.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="py-4 space-y-4">
          <Alert variant="destructive">
            <ZoruAlertTitle>Error Details</ZoruAlertTitle>
            <ZoruAlertDescription>
              {error}
            </ZoruAlertDescription>
          </Alert>
          <p className="text-sm text-zoru-ink-muted">
            To fix this, please reconnect your Facebook account and ensure you grant all requested permissions. Your existing settings will be preserved.
          </p>
          <div className="flex justify-center">
             <Button asChild size="lg" className="bg-zoru-ink hover:bg-zoru-ink/90 w-full">
                <a href={`/api/auth/meta-suite/login?reauthorize=true&state=facebook_reauth`}>
                    <FacebookIcon className="mr-2 h-5 w-5" />
                    Re-authorize with Facebook
                </a>
            </Button>
          </div>
        </div>
      </ZoruDialogContent>
    </Dialog>
  );
}
