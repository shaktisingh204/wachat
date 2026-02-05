
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { getCannedMessages } from '@/app/actions/project.actions';
import { handleSendMessage } from '@/app/actions/whatsapp.actions';
import type { CannedMessage, Template, Contact, Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, LoaderCircle, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendTemplateDialog } from './send-template-dialog';
import { RequestPaymentDialog } from './request-payment-dialog';
import { RequestWhatsAppPaymentDialog } from './request-whatsapp-payment-dialog';
import { SendCatalogDialog } from './send-catalog-dialog';
import { ChatAttachmentMenu } from './chat-attachment-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageInputProps {
    project: WithId<Project>;
    contact: WithId<Contact>;
    templates: WithId<Template>[];
    replyToMessageId?: string;
    disabled?: boolean;
}

const sendInitialState = {
    message: null,
    error: null,
};

function SubmitButton({ onClick, disabled }: { onClick: () => void, disabled?: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="button" size="icon" onClick={onClick} disabled={pending || disabled}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send Message</span>
        </Button>
    );
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

export function ChatMessageInput({ project, contact, templates, replyToMessageId, disabled = false }: ChatMessageInputProps) {
    const [sendState, setSendState] = useState<{ message?: string | null, error?: string | null }>(sendInitialState);
    const { toast } = useToast();

    const [inputValue, setInputValue] = useState('');
    const [cannedMessages, setCannedMessages] = useState<WithId<CannedMessage>[]>([]);
    const [cannedPopoverOpen, setCannedPopoverOpen] = useState(false);

    const [templateToSend, setTemplateToSend] = useState<WithId<Template> | null>(null);
    const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
    const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);
    const [isWhatsAppPaymentOpen, setIsWhatsAppPaymentOpen] = useState(false);
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);

    useEffect(() => {
        getCannedMessages(contact.projectId.toString()).then(setCannedMessages);
    }, [contact.projectId]);

    useEffect(() => {
        if (sendState.error) {
            toast({ title: 'Error sending message', description: sendState.error, variant: 'destructive' });
        }
        if (sendState.message) {
            setInputValue('');
        }
    }, [sendState, toast]);


    const [isUploading, setIsUploading] = useState(false);

    const handleFormSubmit = async (data?: { [key: string]: any }) => {
        const result = await handleSendMessage(null, data || {});
        setSendState(result);
        setIsUploading(false); // Reset upload state
    };

    const handleTextSend = () => {
        if (!inputValue.trim()) return;
        const data: { [key: string]: any } = {
            contactId: contact._id.toString(),
            projectId: contact.projectId.toString(),
            phoneNumberId: contact.phoneNumberId,
            waId: contact.waId,
            messageText: inputValue,
        };
        if (replyToMessageId) {
            data.replyToWamid = replyToMessageId;
        }
        handleFormSubmit(data);
    };


    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true); // Start upload state
        try {
            const base64String = await fileToBase64(file);
            await handleFormSubmit({
                contactId: contact._id.toString(),
                projectId: contact.projectId.toString(),
                phoneNumberId: contact.phoneNumberId,
                waId: contact.waId,
                mediaFile: {
                    content: base64String.split(',')[1],
                    name: file.name,
                    type: file.type,
                }
            });
        } catch (error) {
            console.error("File processing error:", error);
            setIsUploading(false);
            toast({ title: "Error", description: "Failed to process file.", variant: "destructive" });
        } finally {
            // Reset the file input so the same file can be selected again if needed
            event.target.value = '';
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        setCannedPopoverOpen(val.startsWith('/'));
    };

    const handleSelectCanned = (message: WithId<CannedMessage>) => {
        if (message.type === 'text' && message.content.text) {
            setInputValue(message.content.text);
            setCannedPopoverOpen(false);
        } else {
            toast({
                title: 'Unsupported',
                description: 'This feature currently only supports text-based canned replies.',
            });
        }
    };

    const handleMediaClick = (acceptType: string) => {
        const fileInput = document.getElementById('media-file-input') as HTMLInputElement;
        if (fileInput) {
            fileInput.accept = acceptType;
            fileInput.click();
        }
    };

    const filteredCannedMessages = inputValue.startsWith('/')
        ? cannedMessages
            .filter(msg =>
                msg.type === 'text' && msg.name.toLowerCase().includes(inputValue.substring(1).toLowerCase())
            )
            .sort((a, b) => (b.isFavourite ? 1 : 0) - (a.isFavourite ? 1 : 0))
        : [];

    return (
        <>
            {templateToSend && (
                <SendTemplateDialog
                    isOpen={!!templateToSend}
                    onOpenChange={(open) => !open && setTemplateToSend(null)}
                    contact={contact}
                    template={templateToSend}
                />
            )}
            <RequestPaymentDialog
                isOpen={isRazorpayOpen}
                onOpenChange={setIsRazorpayOpen}
                contact={contact}
            />
            <RequestWhatsAppPaymentDialog
                isOpen={isWhatsAppPaymentOpen}
                onOpenChange={setIsWhatsAppPaymentOpen}
                contact={contact}
            />
            {project && project.catalogs && project.catalogs.length > 0 && (
                <SendCatalogDialog
                    isOpen={isCatalogOpen}
                    onOpenChange={setIsCatalogOpen}
                    contact={contact}
                    project={project}
                />
            )}

            <Dialog open={isTemplateSelectorOpen} onOpenChange={setIsTemplateSelectorOpen}>
                <DialogContent className="p-0">
                    <DialogHeader className="px-4 pt-4 pb-2">
                        <DialogTitle>Select a Template</DialogTitle>
                    </DialogHeader>
                    <Command>
                        <CommandInput placeholder="Search templates..." />
                        <CommandList>
                            <CommandEmpty>No templates found.</CommandEmpty>
                            <CommandGroup>
                                {templates.map((template) => (
                                    <CommandItem
                                        key={template._id.toString()}
                                        value={template.name}
                                        onSelect={() => {
                                            setTemplateToSend(template);
                                            setIsTemplateSelectorOpen(false);
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                                        {template.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </DialogContent>
            </Dialog>

            <div className="flex w-full items-center gap-2 p-2 relative">
                <ChatAttachmentMenu
                    disabled={disabled || isUploading}
                    onMediaSelect={handleMediaClick}
                    onTemplateSelect={() => setIsTemplateSelectorOpen(true)}
                    onCatalogSelect={() => setIsCatalogOpen(true)}
                    onRazorpaySelect={() => setIsRazorpayOpen(true)}
                    onWaPaySelect={() => setIsWhatsAppPaymentOpen(true)}
                    project={project}
                />

                {/* Template Selection Dialog (Quick Fix: Reuse the popover logic but in a dialog or just a command palette?) */}
                {/* For now, I will use a simple logical trick:
                    If the user clicks "Template", I'll show a CommandDialog to pick a template.
                    Then clicking one sets `templateToSend`.
                */}

                <Popover open={cannedPopoverOpen} onOpenChange={setCannedPopoverOpen}>
                    <PopoverAnchor asChild>
                        <div className="flex-1 bg-secondary/50 focus-within:bg-secondary rounded-2xl transition-colors border border-transparent focus-within:border-primary/20">
                            <Input
                                name="messageText"
                                placeholder={isUploading ? "Uploading..." : "Type a message"}
                                autoComplete="off"
                                className="border-none shadow-none focus-visible:ring-0 bg-transparent min-h-[44px] py-3"
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleTextSend(); }}
                                disabled={disabled || isUploading}
                            />
                        </div>
                    </PopoverAnchor>
                    {/* Hidden file input */}
                    <input type="file" id="media-file-input" className="hidden" onChange={handleFileChange} />

                    <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        align="end" side="top"
                    >
                        <ScrollArea className="max-h-60">
                            <div className="p-1">
                                {filteredCannedMessages.length > 0 ? (
                                    filteredCannedMessages.map(msg => (
                                        <button
                                            key={msg._id.toString()}
                                            type="button"
                                            className="w-full text-left p-2 rounded-sm hover:bg-accent flex flex-col"
                                            onClick={() => handleSelectCanned(msg)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <p className="font-semibold">{msg.name}</p>
                                                {msg.isFavourite && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
                                            </div>
                                            <p className="text-muted-foreground truncate text-xs">{msg.content.text}</p>
                                        </button>
                                    ))
                                ) : (
                                    <p className="p-4 text-center text-sm text-muted-foreground">
                                        {inputValue.length > 1 ? "No matches found." : "Start typing to search..."}
                                    </p>
                                )}
                            </div>
                        </ScrollArea>
                    </PopoverContent>
                </Popover>

                <div className="flex-shrink-0">
                    <SubmitButton onClick={handleTextSend} disabled={!inputValue.trim() || disabled || isUploading} />
                </div>
            </div>
        </>
    );
}
