'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Minimize2, Maximize2, LoaderCircle, Send } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function EmailCompose() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isOpen = searchParams.get('compose') === 'new';

    // In a real app, send logic would be a Server Action
    const [sending, setSending] = useState(false);
    const { toast } = useToast();

    const handleClose = () => {
        const params = new URLSearchParams(searchParams);
        params.delete('compose');
        router.push(`?${params.toString()}`);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSending(false);
        toast({ title: "Email sent", description: "Your message has been sent successfully." });
        handleClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
                    <DialogTitle>New Message</DialogTitle>
                    {/* Window controls could go here for minimize/maximize if we built a custom non-modal window */}
                </DialogHeader>

                <form onSubmit={handleSend} className="flex flex-col h-full max-h-[80vh]">
                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                        <div className="grid gap-2">
                            <Input
                                placeholder="To"
                                className="border-0 border-b rounded-none px-0 focus-visible:ring-0 shadow-none"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Input
                                placeholder="Subject"
                                className="border-0 border-b rounded-none px-0 focus-visible:ring-0 shadow-none font-medium"
                                required
                            />
                        </div>
                        <div className="flex-1 pt-2">
                            <Textarea
                                placeholder="Write something..."
                                className="min-h-[300px] resize-none border-0 focus-visible:ring-0 shadow-none p-0"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t bg-muted/10 items-center justify-between sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="ghost" size="icon">
                                {/* Formatting tools placeholders */}
                                <span className="font-bold text-sm">B</span>
                            </Button>
                            <Button type="button" variant="ghost" size="icon">
                                <span className="italic text-sm">I</span>
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={handleClose}>Discard</Button>
                            <Button type="submit" disabled={sending}>
                                {sending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                Send
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
