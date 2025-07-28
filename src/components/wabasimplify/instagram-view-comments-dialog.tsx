
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Send, ThumbsUp, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { getInstagramComments } from '@/app/actions/instagram.actions';
import { Skeleton } from '../ui/skeleton';

interface InstagramViewCommentsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  media: any;
  projectId: string;
  onActionComplete: () => void;
}

function Comment({ comment }: { comment: any }) {
    return (
        <div className="flex items-start gap-3">
            <Avatar>
                <AvatarImage src={`https://graph.facebook.com/${comment.from?.id}/picture`} alt={comment.username} />
                <AvatarFallback>{comment.username.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="bg-muted p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold text-sm">{comment.username}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}</p>
                    </div>
                    <p className="text-sm mt-1">{comment.text}</p>
                </div>
            </div>
        </div>
    )
}

export function InstagramViewCommentsDialog({ isOpen, onOpenChange, media, projectId, onActionComplete }: InstagramViewCommentsDialogProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, startLoading] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
      if (isOpen) {
          startLoading(async () => {
              const result = await getInstagramComments(media.id, projectId);
              if (result.error) {
                  toast({title: 'Error', description: `Could not fetch comments: ${result.error}`, variant: 'destructive'});
              } else {
                  setComments(result.comments || []);
              }
          })
      }
  }, [isOpen, media.id, projectId, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
          <DialogDescription>
            Viewing comments for post by @{media.username}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-4">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                ) : (comments.length > 0 ? (
                    comments.map(comment => (
                        <Comment key={comment.id} comment={comment} />
                    ))
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">No comments yet.</p>
                ))}
            </div>
        </ScrollArea>
        <DialogFooter className="mt-auto border-t pt-4">
           <form className="w-full flex items-center gap-2">
                <Textarea name="message" placeholder="Write a comment..." className="flex-1" required disabled/>
                <Button type="submit" disabled><Send className="h-4 w-4" /></Button>
           </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
