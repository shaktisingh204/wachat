
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LoaderCircle, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getEligibleCrosspostPages, handleCrosspostVideo } from '@/app/actions/facebook.actions';
import type { FacebookPage } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
      Crosspost Video
    </Button>
  );
}

interface CrosspostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  projectId: string;
  onSuccess: () => void;
}

export function CrosspostDialog({ isOpen, onOpenChange, postId, projectId, onSuccess }: CrosspostDialogProps) {
  const [state, formAction] = useActionState(handleCrosspostVideo, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [eligiblePages, setEligiblePages] = useState<FacebookPage[]>([]);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
      if (isOpen) {
          startLoading(async () => {
              const result = await getEligibleCrosspostPages(postId, projectId);
              if(result.error) {
                  toast({ title: "Error", description: `Could not fetch eligible pages: ${result.error}`, variant: "destructive"});
              } else {
                  setEligiblePages(result.pages);
              }
          })
      }
  }, [isOpen, postId, projectId, toast]);


  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: 'Video crossposted successfully.' });
      onOpenChange(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Crosspost Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onSuccess]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="postId" value={postId} />
          <DialogHeader>
            <DialogTitle>Crosspost Video</DialogTitle>
            <DialogDescription>
              Select pages to share this video with. Pages must be linked in your Business Manager.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label>Eligible Pages</Label>
            <ScrollArea className="h-48 mt-2 rounded-md border p-2">
                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : eligiblePages.length > 0 ? (
                    <div className="space-y-2">
                        {eligiblePages.map(page => (
                            <div key={page.id} className="flex items-center space-x-2">
                                <Checkbox id={page.id} name="targetPageIds" value={page.id} />
                                <Label htmlFor={page.id} className="font-normal">{page.name}</Label>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-center text-muted-foreground p-4">No eligible pages found for crossposting.</p>
                )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
