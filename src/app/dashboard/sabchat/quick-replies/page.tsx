
'use client';

import { useState, useEffect, useActionState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFormStatus } from 'react-dom';
import { ClayCard, ClayButton } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LoaderCircle, Plus, Trash2, Pencil, LifeBuoy } from 'lucide-react';
import { useProject } from '@/context/project-context';
import type { SabChatQuickReply } from '@/lib/definitions';
import { saveSabChatQuickReply, deleteSabChatQuickReply } from '@/app/actions/sabchat.actions';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const formInitialState: any = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ClayButton type="submit" variant="obsidian" disabled={pending} leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}>
      {isEditing ? 'Save Changes' : 'Add Reply'}
    </ClayButton>
  );
}

function QuickReplyFormDialog({
  isOpen,
  onOpenChange,
  reply,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  reply?: SabChatQuickReply;
  onSave: () => void;
}) {
  const { toast } = useToast();
  const [state, formAction] = useActionState(saveSabChatQuickReply, formInitialState);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success', description: state.message });
      onSave();
      onOpenChange(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSave, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction}>
          {reply?._id && <input type="hidden" name="id" value={reply._id.toString()} />}
          <DialogHeader>
            <DialogTitle>{reply ? 'Edit' : 'Add'} Quick Reply</DialogTitle>
            <DialogDescription>Create a canned response for your agents to use in live chat.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shortcut">Shortcut</Label>
              <Input id="shortcut" name="shortcut" defaultValue={reply?.shortcut} required placeholder="/welcome" />
              <p className="text-xs text-muted-foreground">Must start with a `/` and contain no spaces.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" name="message" defaultValue={reply?.message} required className="min-h-32" />
            </div>
          </div>
          <DialogFooter>
            <ClayButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ClayButton>
            <SubmitButton isEditing={!!reply} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function QuickRepliesPage() {
  const { sessionUser, reloadProject } = useProject();
  const [replies, setReplies] = useState<SabChatQuickReply[]>([]);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<SabChatQuickReply | undefined>(undefined);

  useEffect(() => {
    setReplies(sessionUser?.sabChatSettings?.quickReplies || []);
  }, [sessionUser]);

  const handleOpenDialog = (reply?: SabChatQuickReply) => {
    setEditingReply(reply);
    setIsFormOpen(true);
  };

  const handleDelete = async (replyId: string) => {
    const result = await deleteSabChatQuickReply(replyId);
    if (result.success) {
      toast({ title: 'Success', description: 'Quick reply deleted.' });
      reloadProject();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <QuickReplyFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        reply={editingReply}
        onSave={reloadProject}
      />

      <CrmPageHeader
        title="Quick Replies"
        subtitle="Canned responses for agents to use in live chat"
        icon={LifeBuoy}
        actions={
          <ClayButton variant="obsidian" onClick={() => handleOpenDialog()} leading={<Plus className="h-4 w-4" />}>
            Add Reply
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-clay-border bg-clay-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Shortcut</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Message</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {replies.length > 0 ? (
                replies.map((reply) => (
                  <tr key={reply._id.toString()} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50">
                    <td className="px-4 py-2.5 font-mono text-[13px] text-clay-rose-ink">{reply.shortcut}</td>
                    <td className="px-4 py-2.5 text-[13px] text-clay-ink max-w-lg truncate">{reply.message}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ClayButton
                          variant="pill"
                          size="icon"
                          onClick={() => handleOpenDialog(reply)}
                        >
                          <Pencil className="h-4 w-4" />
                        </ClayButton>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <ClayButton variant="pill" size="icon">
                              <Trash2 className="h-4 w-4 text-clay-red" />
                            </ClayButton>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Quick Reply?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the "{reply.shortcut}" reply?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(reply._id.toString())}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-center h-24 text-[13px] text-clay-ink-muted">
                    No quick replies created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
}
