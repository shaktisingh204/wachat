
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import type { WithId } from 'mongodb';
import { useToast } from '@/hooks/use-toast';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { LoaderCircle, Plus, Trash2, Edit, HelpCircle } from 'lucide-react';
import { useProject } from '@/context/project-context';
import type { SabChatFaqItem } from '@/lib/definitions';
import { saveSabChatFaq, deleteSabChatFaq } from '@/app/actions/sabchat.actions';

const formInitialState = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
      {isEditing ? 'Save Changes' : 'Add FAQ'}
    </Button>
  );
}

function FaqFormDialog({ isOpen, onOpenChange, faqItem, onSave }: { isOpen: boolean, onOpenChange: (open: boolean) => void, faqItem?: SabChatFaqItem, onSave: () => void }) {
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveSabChatFaq, formInitialState);

    useEffect(() => {
        if(state.message) {
            toast({ title: 'Success', description: state.message });
            onSave();
            onOpenChange(false);
        }
        if(state.error) {
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
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
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
  }

  const handleDelete = async (faqId: string) => {
    const result = await deleteSabChatFaq(faqId);
    if(result.success) {
        toast({ title: 'Success', description: 'FAQ deleted.' });
        reloadProject();
    } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  }

  return (
    <>
        <FaqFormDialog isOpen={isFormOpen} onOpenChange={setIsFormOpen} faqItem={editingFaq} onSave={reloadProject} />
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><HelpCircle className="h-6 w-6" />Frequently Asked Questions</CardTitle>
                        <CardDescription>This list is used by the AI assistant to answer questions.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add FAQ
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Question</TableHead>
                                <TableHead>Answer</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {faqs.length > 0 ? faqs.map(faq => (
                                <TableRow key={faq._id.toString()}>
                                    <TableCell className="font-medium max-w-sm truncate">{faq.question}</TableCell>
                                    <TableCell className="text-muted-foreground max-w-sm truncate">{faq.answer}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(faq)}><Edit className="h-4 w-4"/></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                                                    <AlertDialogDescription>Are you sure you want to delete this FAQ?</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(faq._id.toString())}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={3} className="text-center h-24">No FAQs added yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </>
  );
}
