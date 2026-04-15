
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
import { LoaderCircle, Plus, Trash2, Pencil, HelpCircle } from 'lucide-react';
import { useProject } from '@/context/project-context';
import type { SabChatFaqItem } from '@/lib/definitions';
import { saveSabChatFaq, deleteSabChatFaq } from '@/app/actions/sabchat.actions';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const formInitialState: any = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ClayButton type="submit" variant="obsidian" disabled={pending} leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}>
      {isEditing ? 'Save Changes' : 'Add FAQ'}
    </ClayButton>
  );
}

function FaqFormDialog({
  isOpen,
  onOpenChange,
  faqItem,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  faqItem?: SabChatFaqItem;
  onSave: () => void;
}) {
  const { toast } = useToast();
  const [state, formAction] = useActionState(saveSabChatFaq, formInitialState);

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
          {faqItem?._id && <input type="hidden" name="id" value={faqItem._id.toString()} />}
          <DialogHeader>
            <DialogTitle>{faqItem ? 'Edit' : 'Add'} FAQ</DialogTitle>
            <DialogDescription>Add a question and answer to your AI's knowledge base.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input id="question" name="question" defaultValue={faqItem?.question} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Answer</Label>
              <Textarea id="answer" name="answer" defaultValue={faqItem?.answer} required className="min-h-32" />
            </div>
          </div>
          <DialogFooter>
            <ClayButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ClayButton>
            <SubmitButton isEditing={!!faqItem} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function FaqPage() {
  const { sessionUser, reloadProject } = useProject();
  const [faqs, setFaqs] = useState<SabChatFaqItem[]>([]);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<SabChatFaqItem | undefined>(undefined);

  useEffect(() => {
    setFaqs(sessionUser?.sabChatSettings?.faqs || []);
  }, [sessionUser]);

  const handleOpenDialog = (faqItem?: SabChatFaqItem) => {
    setEditingFaq(faqItem);
    setIsFormOpen(true);
  };

  const handleDelete = async (faqId: string) => {
    const result = await deleteSabChatFaq(faqId);
    if (result.success) {
      toast({ title: 'Success', description: 'FAQ deleted.' });
      reloadProject();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <FaqFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        faqItem={editingFaq}
        onSave={reloadProject}
      />

      <CrmPageHeader
        title="FAQ"
        subtitle="Knowledge base used by the AI assistant"
        icon={HelpCircle}
        actions={
          <ClayButton variant="obsidian" onClick={() => handleOpenDialog()} leading={<Plus className="h-4 w-4" />}>
            Add FAQ
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-clay-border bg-clay-surface-2">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Question</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-clay-ink-muted">Answer</th>
                <th className="px-4 py-2.5 text-right text-[12px] font-medium text-clay-ink-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {faqs.length > 0 ? (
                faqs.map((faq) => (
                  <tr key={faq._id.toString()} className="border-b border-clay-border last:border-0 hover:bg-clay-surface-2/50">
                    <td className="px-4 py-2.5 text-[13px] font-medium text-clay-ink max-w-sm truncate">{faq.question}</td>
                    <td className="px-4 py-2.5 text-[13px] text-clay-ink-muted max-w-sm truncate">{faq.answer}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ClayButton
                          variant="pill"
                          size="icon"
                          onClick={() => handleOpenDialog(faq)}
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
                              <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this FAQ?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(faq._id.toString())}>
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
                    No FAQs added yet.
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
