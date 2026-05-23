'use client';

import * as React from 'react';
import { useActionState, useEffect } from 'react';
import {
  Button,
  Card,
  useZoruToast,
} from '@/components/zoruui';
import { LoaderCircle, Send, Trash2 } from 'lucide-react';
import { saveWsIssueComment, deleteWsIssueComment } from '@/app/actions/worksuite/projects.actions';
import { MarkdownEditor } from './markdown-editor';
import { marked } from 'marked';
import { useRouter } from 'next/navigation';

export function IssueComments({ issueId, initialComments = [] }: { issueId: string, initialComments: any[] }) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(saveWsIssueComment, {});
  const formRef = React.useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Comment posted', description: state.message });
      formRef.current?.reset();
      router.refresh();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete comment?')) return;
    try {
      await deleteWsIssueComment(id);
      toast({ title: 'Comment deleted' });
      router.refresh();
    } catch (e) {
      toast({ title: 'Error deleting comment', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {initialComments.length === 0 ? (
          <p className="text-[12.5px] text-zoru-ink-muted">No comments yet. Be the first!</p>
        ) : (
          initialComments.map((c) => (
            <div key={c._id} className="rounded-md border border-zoru-line p-3 bg-zoru-surface">
              <div className="flex items-center justify-between mb-2 border-b border-zoru-line pb-2">
                <span className="font-medium text-[12.5px]">{c.commentByName || 'Unknown User'}</span>
                <div className="flex items-center gap-2 text-[11px] text-zoru-ink-muted">
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                  <button onClick={() => handleDelete(c._id)} className="text-zoru-danger hover:text-zoru-danger-ink">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-[13px] text-zoru-ink"
                dangerouslySetInnerHTML={{ __html: marked.parse(c.comment) as string }}
              />
            </div>
          ))
        )}
      </div>

      <form ref={formRef} action={formAction} className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
        <input type="hidden" name="issueId" value={issueId} />
        {/* We use current user id 1 for mock since we are not authenticating */}
        <input type="hidden" name="commentByUserId" value="1" />
        <input type="hidden" name="commentByName" value="Current User" />
        <div className="mb-2">
          <MarkdownEditor 
            id="comment" 
            name="comment" 
            rows={4} 
            placeholder="Write a comment..." 
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? <LoaderCircle className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Post Comment
          </Button>
        </div>
      </form>
    </div>
  );
}
