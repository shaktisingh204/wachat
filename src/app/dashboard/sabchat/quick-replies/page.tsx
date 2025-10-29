
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
import { LoaderCircle, Plus, Trash2, Edit, LifeBuoy } from 'lucide-react';
import { useProject } from '@/context/project-context';
import type { SabChatQuickReply } from '@/lib/definitions';
import { saveSabChatQuickReply, deleteSabChatQuickReply } from '@/app/actions/sabchat.actions';

const formInitialState = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
      {isEditing ? 'Save Changes' : 'Add Reply'}
    </Button>
  );
}

function QuickReplyFormDialog({ isOpen, onOpenChange, reply, onSave }: { isOpen: boolean, onOpenChange: (open: boolean) => void, reply?: SabChatQuickReply, onSave: () => void }) {
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveSabChatQuickReply, formInitialState);

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
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
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
  }

  const handleDelete = async (replyId: string) => {
    const result = await deleteSabChatQuickReply(replyId);
    if(result.success) {
        toast({ title: 'Success', description: 'Quick reply deleted.' });
        reloadProject();
    } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  }

  return (
    <>
        <QuickReplyFormDialog isOpen={isFormOpen} onOpenChange={setIsFormOpen} reply={editingReply} onSave={reloadProject} />
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><LifeBuoy className="h-6 w-6" />Quick Replies</CardTitle>
                        <CardDescription>Manage canned responses to answer common questions faster.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add Reply
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Shortcut</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {replies.length > 0 ? replies.map(reply => (
                                <TableRow key={reply._id.toString()}>
                                    <TableCell className="font-mono text-primary">{reply.shortcut}</TableCell>
                                    <TableCell className="text-muted-foreground max-w-lg truncate">{reply.message}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(reply)}><Edit className="h-4 w-4"/></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Quick Reply?</AlertDialogTitle>
                                                    <AlertDialogDescription>Are you sure you want to delete the "{reply.shortcut}" reply?</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(reply._id.toString())}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={3} className="text-center h-24">No quick replies created yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </>
  );
}
