
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
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Send, ThumbsUp, Trash2 } from 'lucide-react';
import { handlePostComment, handleDeleteComment, handleLikeObject } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import type { FacebookPost, FacebookComment } from '@/lib/definitions';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatDistanceToNow } from 'date-fns';

const commentInitialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Comment
    </Button>
  );
}

function Comment({ comment, projectId, onActionComplete }: { comment: FacebookComment, projectId: string, onActionComplete: () => void }) {
    const { toast } = useToast();
    const [isLiking, startLiking] = useTransition();
    const [isDeleting, startDeleting] = useTransition();

    const onLike = () => {
        startLiking(async () => {
            await handleLikeObject(comment.id, projectId);
            toast({ description: "Comment liked!" });
        });
    }

    const onDelete = () => {
        startDeleting(async () => {
            const result = await handleDeleteComment(comment.id, projectId);
            if (result.success) {
                toast({ description: "Comment deleted." });
                onActionComplete();
            } else {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <div className="flex items-start gap-3">
            <Avatar>
                <AvatarImage src={`https://graph.facebook.com/${comment.from.id}/picture`} alt={comment.from.name} data-ai-hint="person avatar" />
                <AvatarFallback>{comment.from.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="bg-muted p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                        <p className="font-semibold text-sm">{comment.from.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.created_time), { addSuffix: true })}</p>
                    </div>
                    <p className="text-sm mt-1">{comment.message}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                     <Button variant="ghost" size="sm" className="text-xs h-auto py-0.5 px-1.5" onClick={onLike} disabled={isLiking}>Like</Button>
                     <Button variant="ghost" size="sm" className="text-xs h-auto py-0.5 px-1.5" disabled>Reply</Button>
                     <Button variant="ghost" size="sm" className="text-xs h-auto py-0.5 px-1.5 text-destructive" onClick={onDelete} disabled={isDeleting}>Delete</Button>
                </div>
            </div>
        </div>
    )
}

interface ViewCommentsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  post: FacebookPost;
  projectId: string;
  onActionComplete: () => void;
}

export function ViewCommentsDialog({ isOpen, onOpenChange, post, projectId, onActionComplete }: ViewCommentsDialogProps) {
  const [state, formAction] = useActionState(handlePostComment, commentInitialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.success) {
        toast({ description: 'Comment posted successfully.' });
        formRef.current?.reset();
        onActionComplete();
    }
    if (state.error) {
      toast({ title: 'Error Posting Comment', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onActionComplete]);
  
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [post.comments]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
          <DialogDescription>
            Viewing comments for post: "{post.message?.substring(0, 30)}..."
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6" ref={scrollRef as any}>
            <div className="space-y-4 py-4">
                {(post.comments?.data || []).length > 0 ? (
                    post.comments?.data.map(comment => (
                        <Comment key={comment.id} comment={comment} projectId={projectId} onActionComplete={onActionComplete} />
                    ))
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">No comments yet.</p>
                )}
            </div>
        </ScrollArea>
        <DialogFooter className="mt-auto border-t pt-4">
           <form action={formAction} ref={formRef} className="w-full flex items-center gap-2">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="objectId" value={post.id} />
                <Textarea name="message" placeholder="Write a comment..." className="flex-1" required />
                <SubmitButton />
           </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    