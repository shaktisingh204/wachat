
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId } from 'mongodb';
import { saveCannedMessageAction, CannedMessage } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save } from 'lucide-react';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Message
    </Button>
  );
}

interface CannedMessageFormDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    projectId: string;
    existingMessage: WithId<CannedMessage> | null;
    onSubmitted: () => void;
}

export function CannedMessageFormDialog({ isOpen, setIsOpen, projectId, existingMessage, onSubmitted }: CannedMessageFormDialogProps) {
    const [state, formAction] = useActionState(saveCannedMessageAction, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();
    const [messageType, setMessageType] = useState<CannedMessage['type'] | ''>(existingMessage?.type || 'text');

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            onSubmitted();
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSubmitted]);

    useEffect(() => {
        if (isOpen) {
            setMessageType(existingMessage?.type || 'text');
        } else {
            formRef.current?.reset();
        }
    }, [isOpen, existingMessage]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="projectId" value={projectId} />
                    {existingMessage && <input type="hidden" name="_id" value={existingMessage._id.toString()} />}

                    <DialogHeader>
                        <DialogTitle>{existingMessage ? 'Edit' : 'Create'} Canned Message</DialogTitle>
                        <DialogDescription>
                            Save a message for quick use in live chat conversations.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" name="name" placeholder="e.g., Welcome Message" defaultValue={existingMessage?.name} required />
                            <p className="text-xs text-muted-foreground">A unique name to identify this message.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select name="type" value={messageType} onValueChange={(val) => setMessageType(val as CannedMessage['type'])} required>
                                <SelectTrigger id="type">
                                    <SelectValue placeholder="Select message type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="image">Image</SelectItem>
                                    <SelectItem value="video">Video</SelectItem>
                                    <SelectItem value="audio">Audio</SelectItem>
                                    <SelectItem value="document">Document</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {messageType === 'text' ? (
                            <div className="space-y-2">
                                <Label htmlFor="text">Content</Label>
                                <Textarea id="text" name="text" placeholder="Enter your message..." className="min-h-32" defaultValue={existingMessage?.content.text} required/>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="mediaUrl">Media URL</Label>
                                    <Input id="mediaUrl" name="mediaUrl" placeholder="https://example.com/image.png" defaultValue={existingMessage?.content.mediaUrl} required/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="caption">Caption (optional)</Label>
                                    <Textarea id="caption" name="caption" placeholder="A caption for your media..." defaultValue={existingMessage?.content.caption}/>
                                </div>
                                {messageType === 'document' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="fileName">File Name (optional)</Label>
                                        <Input id="fileName" name="fileName" placeholder="e.g., product_catalog.pdf" defaultValue={existingMessage?.content.fileName} />
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex items-center space-x-2">
                            <Switch id="isFavourite" name="isFavourite" defaultChecked={existingMessage?.isFavourite} />
                            <Label htmlFor="isFavourite">Mark as Favourite</Label>
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
