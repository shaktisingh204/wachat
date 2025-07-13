
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCrmNote } from '@/app/actions/crm.actions';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
        {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
        Add Note
    </Button>
  );
}


export function CrmContactNotes({ contactId, notes: initialNotes }: { contactId: string, notes: { content: string, createdAt: Date, author: string }[] }) {
    const [state, formAction] = useActionState(addCrmNote, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [notes, setNotes] = useState(initialNotes);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
            formRef.current?.reset();
            // Optimistically add the new note
            const newNote = {
                content: formRef.current?.noteContent.value,
                createdAt: new Date(),
                author: "You" // This is a simplification
            };
            setNotes(prev => [newNote, ...prev]);
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="contactId" value={contactId} />
                    <div className="space-y-2">
                        <Textarea name="noteContent" placeholder="Add a note about this contact..." required/>
                        <div className="flex justify-end">
                            <SubmitButton />
                        </div>
                    </div>
                </form>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-4">
                {notes.map((note, index) => (
                    <div key={index} className="flex items-start gap-3 w-full">
                        <Avatar className="h-8 w-8 mt-1"><AvatarFallback>{note.author.charAt(0)}</AvatarFallback></Avatar>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-sm">{note.author}</p>
                                <p className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</p>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                        </div>
                    </div>
                ))}
            </CardFooter>
        </Card>
    );
}
