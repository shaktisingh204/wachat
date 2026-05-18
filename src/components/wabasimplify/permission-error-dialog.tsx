
'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/zoruui';
import { ZoruAlert, ZoruAlertDescription, ZoruAlertTitle } from '@/components/zoruui';
import { AlertCircle, Facebook } from 'lucide-react';
import type { WithId, Project } from '@/lib/definitions';
import { FacebookIcon } from './custom-sidebar-components';
import { ZoruButton } from '../ui/button';

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
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle className="flex items-center gap-2">
            <AlertCircle className="text-destructive h-6 w-6" />
            Permissions Required
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            SabNode needs additional permissions to access this feature.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <div className="py-4 space-y-4">
          <ZoruAlert variant="destructive">
            <ZoruAlertTitle>Error Details</ZoruAlertTitle>
            <ZoruAlertDescription>
              {error}
            </ZoruAlertDescription>
          </ZoruAlert>
          <p className="text-sm text-muted-foreground">
            To fix this, please reconnect your Facebook account and ensure you grant all requested permissions. Your existing settings will be preserved.
          </p>
          <div className="flex justify-center">
             <ZoruButton asChild size="lg" className="bg-[#1877F2] hover:bg-[#1877F2]/90 w-full">
                <a href={`/api/auth/meta-suite/login?reauthorize=true&state=facebook_reauth`}>
                    <FacebookIcon className="mr-2 h-5 w-5" />
                    Re-authorize with Facebook
                </a>
            </ZoruButton>
          </div>
        </div>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
