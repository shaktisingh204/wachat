'use client';

import { Button, Textarea, Avatar, ZoruAvatarFallback } from '@/components/zoruui';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { ClayCard } from '@/components/clay';

import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCrmNote } from '@/app/actions/crm.actions';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
    >
        Add Note
    </Button>
  );
}

interface CrmNotesProps {
    recordId: string;
    recordType:
        | 'contact'
        | 'account'
        | 'deal'
        | 'lead'
        | 'invoice'
        | 'quotation'
        | 'paymentReceipt'
        | 'creditNote'
        | 'proforma'
        | 'contract'
        | 'subscription';
    notes: { content: string; createdAt: Date; author: string }[];
}

export function CrmNotes({ recordId, recordType, notes: initialNotes }: CrmNotesProps) {
    const [state, formAction] = useActionState(addCrmNote as any, initialState as any);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [notes, setNotes] = useState(initialNotes);

    useEffect(() => {
        setNotes(initialNotes);
    }, [initialNotes]);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
            if (state.note) {
                setNotes(prev => [
                    {
                        content: state.note.content,
                        createdAt: new Date(state.note.createdAt),
                        author: state.note.author,
                    },
                    ...prev,
                ]);
            }
            formRef.current?.reset();
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);
    
    return (
        <ClayCard>
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Notes &amp; Activity</h2>
            </div>
            <div>
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="recordId" value={recordId} />
                    <input type="hidden" name="recordType" value={recordType} />
                    <div className="space-y-2">
                        <Textarea name="noteContent" placeholder={`Add a note about this ${recordType}...`} required/>
                        <div className="flex justify-end">
                            <SubmitButton />
                        </div>
                    </div>
                </form>
                <div className="mt-4 space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                    {notes.map((note, index) => (
                        <div key={index} className="flex items-start gap-3 w-full">
                            <Avatar className="h-8 w-8 mt-1"><ZoruAvatarFallback>{note.author.charAt(0)}</ZoruAvatarFallback></Avatar>
                            <div className="flex-1">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-sm text-foreground">{note.author}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</p>
                                </div>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </ClayCard>
    );
}
