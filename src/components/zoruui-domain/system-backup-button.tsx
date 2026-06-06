'use client';

import { Button, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/sabcrm/20ui/compat';
import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseBackup, LoaderCircle } from 'lucide-react';

export function SystemBackupButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  
  const onBackup = () => {
    startTransition(async () => {
      toast({
        title: 'Starting Backup...',
        description: 'Initiating full system backup.',
      });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: 'Backup Complete',
        description: 'System backup has been completed successfully.',
      });
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          {isPending ? (
            <>
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              Backing up...
            </>
          ) : (
            <>
              <DatabaseBackup className="mr-2 h-4 w-4" />
              Trigger System Backup
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Trigger System Backup?</AlertDialogTitle>
          <AlertDialogDescription>
            This will initiate a full database and file system backup. This process might take some time and can impact system performance during the operation. Are you sure you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onBackup}>
            Start Backup
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
