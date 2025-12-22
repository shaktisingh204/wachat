

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { getCannedMessages } from '@/app/actions/project.actions';
import { handleSendMessage } from '@/app/actions/whatsapp.actions';
import type { CannedMessage, Template, Contact, Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, LoaderCircle, Star, ClipboardList, File as FileIcon, Image as ImageIcon, IndianRupee, ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendTemplateDialog } from './send-template-dialog';
import { RequestPaymentDialog } from './request-payment-dialog';
import { RequestWhatsAppPaymentDialog } from './request-whatsapp-payment-dialog';
import { WaPayIcon } from './custom-sidebar-components';
import { SendCatalogDialog } from './send-catalog-dialog';

interface ChatMessageInputProps {
    project: WithId<Project>;
    contact: WithId<Contact>;
    templates: WithId<Template>[];
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

export function ChatMessageInput({ project, contact, templates }: ChatMessageInputProps) {
    const [sendState, setSendState] = useState(sendInitialState);
    const { toast } = useToast();

    const [inputValue, setInputValue] = useState('');
    const [cannedMessages, setCannedMessages] = useState<WithId<CannedMessage>[]>([]);
    const [cannedPopoverOpen, setCannedPopoverOpen] = useState(false);
    const [attachmentPopoverOpen, setAttachmentPopoverOpen] = useState(false);
    
    const [templateToSend, setTemplateToSend] = useState<WithId<Template> | null>(null);
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

    const handleFormSubmit = async (data?: { [key: string]: any }) => {
        const result = await handleSendMessage(null, data || {});
        setSendState(result);
    };

    const handleTextSend = () => {
        if (!inputValue.trim()) return;
        handleFormSubmit({
            contactId: contact._id.toString(),
            projectId: contact.projectId.toString(),
            phoneNumberId: contact.phoneNumberId,
            waId: contact.waId,
            messageText: inputValue,
        });
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const base64String = await fileToBase64(file);
        handleFormSubmit({
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
    
    const TemplatePopoverContent = (
        <PopoverContent side="top" align="start" className="p-1 w-56">
            <ScrollArea className="max-h-60">
                <div className="p-1 space-y-1">
                    {templates.length > 0 ? templates.map(template => (
                        <button key={template._id.toString()} type="button" className="w-full text-left p-2 rounded-sm hover:bg-accent flex items-center text-sm" onClick={() => setTemplateToSend(template)}>
                            <ClipboardList className="h-4 w-4 mr-2"/>
                            {template.name}
                        </button>
                    )) : <p className="text-xs text-center p-2 text-muted-foreground">No approved templates found.</p>}
                </div>
            </ScrollArea>
        </PopoverContent>
    );

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
        {project?.catalogs && project.catalogs.length > 0 && (
            <SendCatalogDialog
                isOpen={isCatalogOpen}
                onOpenChange={setIsCatalogOpen}
                contact={contact}
                project={project}
            />
        )}
        <div className="flex w-full items-center gap-2">
            <Popover open={cannedPopoverOpen} onOpenChange={setCannedPopoverOpen}>
                 <PopoverAnchor asChild>
                    <Input
                        name="messageText"
                        placeholder="Type a message or / for canned replies"
                        autoComplete="off"
                        className="flex-1"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleTextSend(); }}
                    />
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

            {/* Desktop Buttons */}
            <div className="hidden md:flex items-center gap-1">
                 <Button variant="ghost" size="icon" onClick={() => handleMediaClick('image/*,video/*')}><ImageIcon className="h-4 w-4" /><span className="sr-only">Send Image or Video</span></Button>
                 <Button variant="ghost" size="icon" onClick={() => handleMediaClick('application/pdf')}><FileIcon className="h-4 w-4" /><span className="sr-only">Send Document</span></Button>
                 <Button variant="ghost" size="icon" onClick={() => setIsRazorpayOpen(true)}><IndianRupee className="h-4 w-4" /><span className="sr-only">Request Payment</span></Button>
                 <Button variant="ghost" size="icon" onClick={() => setIsWhatsAppPaymentOpen(true)}><WaPayIcon className="h-4 w-4" /><span className="sr-only">Request WhatsApp Payment</span></Button>
                 {project?.catalogs && project.catalogs.length > 0 && <Button variant="ghost" size="icon" onClick={() => setIsCatalogOpen(true)}><ShoppingBag className="h-4 w-4" /><span className="sr-only">Send Catalog</span></Button>}
                <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon"><ClipboardList className="h-4 w-4" /><span className="sr-only">Send Template</span></Button></PopoverTrigger>{TemplatePopoverContent}</Popover>
            </div>
            
            {/* Mobile Popover */}
            <div className="md:hidden">
                <Popover open={attachmentPopoverOpen} onOpenChange={setAttachmentPopoverOpen}>
                    <PopoverTrigger asChild><Button variant="ghost" size="icon"><Paperclip className="h-4 w-4" /></Button></PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-1">
                        <div className="grid gap-1">
                            <Button variant="ghost" className="w-full justify-start" onClick={() => { handleMediaClick('image/*,video/*'); setAttachmentPopoverOpen(false); }}><ImageIcon className="mr-2 h-4 w-4" /> Media (Image/Video)</Button>
                             <Button variant="ghost" className="w-full justify-start" onClick={() => { handleMediaClick('application/pdf'); setAttachmentPopoverOpen(false); }}><FileIcon className="mr-2 h-4 w-4" /> Document</Button>
                             <Button variant="ghost" className="w-full justify-start" onClick={() => { setIsRazorpayOpen(true); setAttachmentPopoverOpen(false); }}><IndianRupee className="mr-2 h-4 w-4" /> Razorpay Payment</Button>
                             <Button variant="ghost" className="w-full justify-start" onClick={() => { setIsWhatsAppPaymentOpen(true); setAttachmentPopoverOpen(false); }}><WaPayIcon className="mr-2 h-4 w-4" /> WhatsApp Pay</Button>
                             {project?.catalogs && project.catalogs.length > 0 && <Button variant="ghost" className="w-full justify-start" onClick={() => { setIsCatalogOpen(true); setAttachmentPopoverOpen(false); }}><ShoppingBag className="mr-2 h-4 w-4" /> Send Catalog</Button>}
                             <Popover><PopoverTrigger asChild><Button variant="ghost" className="w-full justify-start"><ClipboardList className="mr-2 h-4 w-4" /> Template</Button></PopoverTrigger>{TemplatePopoverContent}</Popover>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            
            <SubmitButton onClick={handleTextSend} disabled={!inputValue.trim()} />
        </div>
        </>
    );
}
