'use client';

import {
  Input,
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent,
  ScrollArea,
  Modal,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { getCannedMessages } from '@/app/actions/project.actions';
import { handleSendMessage } from '@/app/actions/whatsapp.actions';
import type { CannedMessage,
  Template,
  Contact,
  Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Send, LoaderCircle, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SendTemplateDialog } from './send-template-dialog';
import { RequestPaymentDialog } from './request-payment-dialog';
import { RequestWhatsAppPaymentDialog } from './request-whatsapp-payment-dialog';
import { SendCatalogDialog } from './send-catalog-dialog';
import { ChatAttachmentMenu } from './chat-attachment-menu';

import { Check } from 'lucide-react';
import { SabFileToFileButton } from '@/components/sabfiles';

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}

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
        <Button
            type="button"
            variant="primary"
            onClick={onClick}
            disabled={pending || disabled}
            aria-label="Send Message"
            className="u-icon-btn u-icon-btn--md"
        >
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

    // AI Copilot bridge: the copilot dock dispatches `wachat:copilot-insert`
    // with the generated draft. Insert it into THIS composer when the event
    // targets the active contact (additive; no prop drilling through ChatWindow).
    useEffect(() => {
        function onCopilotInsert(e: Event) {
            const detail = (e as CustomEvent).detail as
                | { contactId?: string; text?: string }
                | undefined;
            if (!detail?.text) return;
            if (detail.contactId && detail.contactId !== contact._id.toString()) return;
            setInputValue((prev) => (prev ? `${prev.trim()} ${detail.text}` : detail.text!));
        }
        window.addEventListener('wachat:copilot-insert', onCopilotInsert as EventListener);
        return () =>
            window.removeEventListener('wachat:copilot-insert', onCopilotInsert as EventListener);
    }, [contact]);

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

    const uploadMediaFile = async (file: File) => {
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
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            await uploadMediaFile(file);
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

    // Safety timeout to prevent stuck "Uploading" state
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isUploading) {
            timeout = setTimeout(() => {
                setIsUploading(false);
                toast({ title: 'Upload Timeout', description: 'The upload took too long and was reset.', variant: 'destructive' });
            }, 30000); // 30 seconds timeout
        }
        return () => clearTimeout(timeout);
    }, [isUploading, toast]);

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

            <Modal
                open={isTemplateSelectorOpen}
                onClose={() => setIsTemplateSelectorOpen(false)}
                title="Select a Template"
                className="p-0"
            >
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
                                    <Check className={cx("mr-2 h-4 w-4 opacity-0")} />
                                    {template.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </Modal>

            <div className="20ui flex w-full items-center gap-2 p-2 relative">
                <ChatAttachmentMenu
                    disabled={disabled || isUploading}
                    onMediaSelect={(type) => setTimeout(() => handleMediaClick(type), 0)}
                    onTemplateSelect={() => setTimeout(() => setIsTemplateSelectorOpen(true), 0)}
                    onCatalogSelect={() => setTimeout(() => setIsCatalogOpen(true), 0)}
                    onRazorpaySelect={() => setTimeout(() => setIsRazorpayOpen(true), 0)}
                    onWaPaySelect={() => setTimeout(() => setIsWhatsAppPaymentOpen(true), 0)}
                    project={project}
                />
                <SabFileToFileButton
                    accept="all"
                    variant="ghost"
                    className="h-9 px-2 text-xs"
                    onPickFile={(file) => uploadMediaFile(file)}
                    onError={(err) => toast({ title: 'Pick failed', description: err.message, variant: 'destructive' })}
                >
                    SabFiles
                </SabFileToFileButton>

                {/* Template Selection Dialog (Quick Fix: Reuse the popover logic but in a dialog or just a command palette?) */}
                {/* For now, I will use a simple logical trick:
                    If the user clicks "Template", I'll show a Command palette to pick a template.
                    Then clicking one sets `templateToSend`.
                */}

                <Popover open={cannedPopoverOpen} onOpenChange={setCannedPopoverOpen}>
                    <PopoverAnchor asChild>
                        <div
                            className="flex-1 rounded-2xl transition-colors border border-transparent bg-[var(--st-surface-muted)]"
                        >
                            <Input
                                name="messageText"
                                placeholder={isUploading ? "Uploading..." : "Type a message"}
                                autoComplete="off"
                                className="min-h-[44px] py-3 border-none shadow-none bg-transparent"
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
                                            className="w-full text-left p-2 rounded-sm flex flex-col bg-transparent hover:bg-[var(--st-surface-hover)] transition-colors"
                                            onClick={() => handleSelectCanned(msg)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <p className="font-semibold">{msg.name}</p>
                                                {msg.isFavourite && (
                                                    <Star
                                                        className="h-4 w-4 text-[var(--st-text-muted)] fill-[var(--st-text-muted)]"
                                                    />
                                                )}
                                            </div>
                                            <p className="truncate text-xs text-[var(--st-text-muted)]">{msg.content.text}</p>
                                        </button>
                                    ))
                                ) : (
                                    <p className="p-4 text-center text-sm text-[var(--st-text-muted)]">
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
