
'use client';

import React, { useState, useTransition } from 'react';
import { handleTranslateMessage } from '@/app/actions/ai-actions';
import type { AnyMessage, OutgoingMessage, InteractiveMessageContent } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, Download, File as FileIcon, Image as ImageIcon, XCircle, Languages, LoaderCircle, RefreshCw, ShoppingBag, Video, PlayCircle, Music, List, Bot, MapPin } from 'lucide-react';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { getPaymentRequestStatus } from '@/app/actions/whatsapp.actions';
import { TemplateMessageContent } from './messages/template-message-content';
import { ProductMessageContent } from './messages/product-message-content';
import { OrderMessageContent } from './messages/order-message-content';
import { ContactMessageContent } from './messages/contact-message-content';


interface ChatMessageProps {
    message: AnyMessage;
    conversation: AnyMessage[];
}

function StatusTicks({ message }: { message: OutgoingMessage }) {
    const { status, statusTimestamps } = message;

    const getIcon = () => {
        switch (status) {
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'read':
                return <CheckCheck className="h-4 w-4 text-blue-500" />;
            case 'delivered':
                return <CheckCheck className="h-4 w-4" />;
            case 'sent':
                return <Check className="h-4 w-4" />;
            default:
                return <Clock className="h-4 w-4" />; // for 'pending'
        }
    };

    const formatTimestamp = (date: Date | string | undefined) => {
        if (!date) return '';
        return new Date(date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-muted-foreground">{getIcon()}</span>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                    <div className="text-xs space-y-1 p-1">
                        {statusTimestamps?.read && <p>Read: {formatTimestamp(statusTimestamps.read)}</p>}
                        {statusTimestamps?.delivered && <p>Delivered: {formatTimestamp(statusTimestamps.delivered)}</p>}
                        {statusTimestamps?.sent && <p>Sent: {formatTimestamp(statusTimestamps.sent)}</p>}
                        {status === 'pending' && <p>Pending...</p>}
                        {status === 'failed' && <p>Failed</p>}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

function MediaContent({ message }: { message: AnyMessage }) {
    const type = message.type;
    const media = message.content[type as keyof typeof message.content] as any;

    if (!media && type !== 'unsupported') return <div className="text-sm text-muted-foreground italic">[Unsupported message content]</div>;
    
    const url = media.url || media.link;
    const caption = media.caption || '';
    const fileName = media.filename || 'download';

    if (type === 'image') {
        if (url) {
            return (
                <div className="space-y-2">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video w-64 bg-muted rounded-lg overflow-hidden">
                        <Image src={url} alt={caption || 'Sent image'} layout="fill" objectFit="cover" data-ai-hint="chat image" />
                    </a>
                    {caption && <p className="text-sm">{caption}</p>}
                </div>
            );
        }
        return <div className="text-sm text-muted-foreground italic">[Image received - preview unavailable]</div>;
    }
    
    if (type === 'sticker') {
         if (url) {
            return (
                <div className="relative w-32 h-32">
                    <Image src={url} alt="Sticker" layout="fill" objectFit="contain" />
                </div>
            )
         }
         return <div className="text-sm text-muted-foreground italic">[Sticker received]</div>;
    }

    if (type === 'video') {
         if (url) {
            return (
                <div className="space-y-2">
                    <video src={url} controls className="rounded-lg w-64 aspect-video bg-black" />
                    {caption && <p className="text-sm">{caption}</p>}
                </div>
            );
        }
        return <div className="text-sm text-muted-foreground italic">[Video received]</div>;
    }

    if (type === 'document') {
        if (url) {
            return (
                <a href={url} target="_blank" rel="noopener noreferrer" download={fileName} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-background transition-colors max-w-xs">
                    <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 overflow-hidden">
                        <p className="font-semibold truncate">{fileName}</p>
                        {caption && <p className="text-xs text-muted-foreground truncate">{caption}</p>}
                    </div>
                    <Download className="h-5 w-5 text-muted-foreground" />
                </a>
            );
        }
        return <div className="text-sm text-muted-foreground italic">[Document received: {fileName}]</div>;
    }

    if (type === 'audio') {
         if (url) {
            return (
                <div className="w-64">
                    <audio src={url} controls className="w-full" />
                </div>
            )
         }
        return <div className="text-sm text-muted-foreground italic">[Audio message]</div>;
    }

    if (type === 'location') {
        const { latitude, longitude, name, address } = media;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        return (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-background transition-colors max-w-xs">
                <MapPin className="h-8 w-8 text-destructive flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                    <p className="font-semibold truncate">{name || 'Location'}</p>
                    <p className="text-xs text-muted-foreground truncate">{address || `${latitude}, ${longitude}`}</p>
                </div>
            </a>
        );
    }
    
    return <div className="text-sm text-muted-foreground italic">[{type} message]</div>;
};

const PaymentRequestContent = ({ message }: { message: OutgoingMessage }) => {
    const { toast } = useToast();
    const [isChecking, startTransition] = useTransition();
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

    const checkStatus = async () => {
        startTransition(async () => {
            const result = await getPaymentRequestStatus(message.projectId.toString(), message.content.payment_request.id);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else if (result.status) {
                setPaymentStatus(result.status);
            }
        });
    };

    const statusToText = (status: string | null) => {
        if (!status) return 'Check Status';
        return status.replace(/_/g, ' ').toLowerCase();
    };

    return (
        <div className="space-y-2 w-64">
            <p className="font-semibold">Payment Request</p>
            <p className="text-sm">Amount: ₹{message.content.payment_request.amount}</p>
            <p className="text-xs text-muted-foreground">{message.content.payment_request.description}</p>
            <Button size="sm" className="w-full mt-2" onClick={checkStatus} disabled={isChecking}>
                {isChecking ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2 capitalize">{statusToText(paymentStatus)}</span>
            </Button>
        </div>
    );
};

const InteractiveMessageDisplay = ({ content }: { content: InteractiveMessageContent }) => {
    const { header, body, footer, action } = content;

    const renderAction = () => {
        if (action.buttons) {
            return (
                <div className="mt-2 space-y-1">
                    {action.buttons.map(button => (
                        <div key={button.reply.id} className="text-center text-primary font-medium bg-white/80 dark:bg-muted/50 py-1.5 rounded-md text-sm border">
                            {button.reply.title}
                        </div>
                    ))}
                </div>
            );
        }
        if (action.button) {
            return (
                 <div className="mt-2 text-center text-primary font-medium bg-white/80 dark:bg-muted/50 py-2.5 rounded-md text-sm border font-semibold">
                    <List className="inline-block h-4 w-4 mr-2" />
                    {action.button}
                </div>
            );
        }
        if(action.catalog_id && action.product_retailer_id) {
            return <ProductMessageContent catalogId={action.catalog_id} productRetailerId={action.product_retailer_id} isReply={true} />
        }
        return null;
    }

    return (
        <div className="space-y-2 w-64">
            {header && <p className="font-bold text-lg">{header.text}</p>}
            {body && <p className="whitespace-pre-wrap">{body.text}</p>}
            {footer && <p className="text-xs text-muted-foreground pt-1">{footer.text}</p>}
            {action && renderAction()}
        </div>
    )
}

const QuotedMessage = ({ message }: { message: AnyMessage }) => {
    if (!message) return null;

    const isOutgoing = message.direction === 'out';
    const senderName = isOutgoing ? "You" : message.content?.profile?.name || 'User';

    let contentPreview = 'Message';
    if (message.type === 'text' && message.content.text?.body) {
        contentPreview = message.content.text.body;
    } else if (message.type === 'image') {
        contentPreview = 'Photo';
    } else if (message.type === 'video') {
        contentPreview = 'Video';
    } else if (message.type === 'sticker') {
        contentPreview = 'Sticker';
    } else if (message.type === 'interactive' && message.content.interactive.button_reply) {
        contentPreview = message.content.interactive.button_reply.title;
    }
    
    return (
        <div className="bg-black/5 dark:bg-white/5 p-2 rounded-md border-l-2 border-primary mb-2">
            <p className="font-semibold text-sm text-primary">{senderName}</p>
            <p className="text-xs text-muted-foreground truncate">{contentPreview}</p>
        </div>
    )
}

const MessageBody = ({ message, isOutgoing, conversation }: ChatMessageProps) => {
    // Reaction messages are handled separately as they are not message bubbles.
    if (message.type === 'reaction') {
        return null; 
    }
    
    // Outgoing template message
    if (isOutgoing && message.type === 'template') {
        return <TemplateMessageContent content={message.content.template} />;
    }

    // Incoming or Outgoing Interactive Message
    if (message.type === 'interactive') {
        // This is a user's reply to an interactive message
        if (message.content.interactive.button_reply) {
            return <p className="whitespace-pre-wrap">{message.content.interactive.button_reply.title}</p>;
        }
        if (message.content.interactive.list_reply) {
            return <p className="whitespace-pre-wrap">{message.content.interactive.list_reply.title}</p>;
        }
        // This is the interactive message itself
        return <InteractiveMessageDisplay content={message.content.interactive} />;
    }
    
    // Incoming Order message
    if (!isOutgoing && message.type === 'order') {
        return <OrderMessageContent order={message.content.order} />;
    }

    // Incoming Product message
    if (!isOutgoing && message.type === 'product') {
        return <ProductMessageContent catalogId={message.content.catalog_id} productRetailerId={message.content.product_retailer_id} />;
    }

    // Contact card message
    if (message.type === 'contacts') {
        return <ContactMessageContent contacts={message.content.contacts} />;
    }
    
    // Standard text message
    if (message.type === 'text' && message.content.text?.body) {
        return <p className="whitespace-pre-wrap">{message.content.text.body}</p>;
    }

    if (message.type === 'payment_request') {
        return <PaymentRequestContent message={message as OutgoingMessage} />;
    }

    // Media and other types
    return <MediaContent message={message} />;
};


export const ChatMessage = React.memo(function ChatMessage({ message, conversation }: ChatMessageProps) {
    const isOutgoing = message.direction === 'out';
    const timestamp = message.messageTimestamp || message.createdAt;
    
    const [translatedText, setTranslatedText] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const { toast } = useToast();

    // Do not render reaction messages as main bubbles.
    if (message.type === 'reaction') {
        return null;
    }

    const repliedToId = message.content?.context?.message_id;
    const quotedMessage = repliedToId ? conversation.find(m => m.wamid === repliedToId) : null;

    const onTranslate = async () => {
        let originalText: string | undefined;

        if (message.type === 'text' && message.content.text?.body) {
            originalText = message.content.text.body;
        } else if (message.type === 'interactive' && message.content.interactive.button_reply) {
            originalText = message.content.interactive.button_reply.title;
        }

        if (!originalText) return;

        setIsTranslating(true);
        const result = await handleTranslateMessage(originalText);
        setIsTranslating(false);

        if (result.error) {
            toast({ title: 'Translation Error', description: result.error, variant: 'destructive' });
        } else if (result.translatedText) {
            setTranslatedText(result.translatedText);
        }
    };
    
    const isTextBased = message.type === 'text' || (message.type === 'interactive' && message.content.interactive.button_reply);
    
    return (
        <div className={cn("flex items-end gap-2 group/message relative", isOutgoing ? "justify-end" : "justify-start")}>
            {!isOutgoing && (
                <Avatar className="h-8 w-8 self-end">
                    <AvatarFallback>{message.content?.profile?.name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
            )}
             <div className="absolute top-0 opacity-0 group-hover/message:opacity-100 transition-opacity"
                 style={isOutgoing ? { right: '100%', marginRight: '0.5rem'} : { left: '100%', marginLeft: '0.5rem' }}
             >
                <div className="flex items-center bg-background border rounded-full shadow-sm p-0.5">
                    {isTextBased && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onTranslate} disabled={isTranslating}>
                            {isTranslating ? <LoaderCircle className="h-3 w-3 animate-spin"/> : <Languages className="h-3 w-3" />}
                        </Button>
                    )}
                </div>
            </div>
            <div
                className={cn(
                    "max-w-[70%] rounded-lg p-2 px-3 text-sm flex flex-col shadow-sm",
                    isOutgoing
                        ? "bg-[#E2F7CB] dark:bg-[#056056] text-gray-800 dark:text-gray-50 rounded-br-none"
                        : "bg-white dark:bg-muted rounded-bl-none"
                )}
            >
                {quotedMessage && <QuotedMessage message={quotedMessage} />}
                
                <MessageBody message={message} isOutgoing={isOutgoing} conversation={conversation} />

                {translatedText && (
                    <>
                        <Separator className="my-2 bg-black/10 dark:bg-white/10" />
                        <p className="whitespace-pre-wrap italic text-muted-foreground">{translatedText}</p>
                    </>
                )}

                {isOutgoing && message.status === 'failed' && (
                    <p className="text-xs mt-1 pt-1 border-t border-black/10 text-red-600 dark:text-red-400">
                        Failed: {message.error}
                    </p>
                )}

                <div className="flex items-center gap-1.5 self-end mt-1">
                    <p className="text-xs text-muted-foreground/80">
                        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isOutgoing && <StatusTicks message={message as OutgoingMessage} />}
                </div>
            </div>
            {message.reaction && (
                <div className={cn(
                    "absolute -bottom-3 bg-background border rounded-full text-lg px-1.5 py-0.5 shadow-sm",
                    isOutgoing ? 'right-0' : 'left-8'
                )}>
                    {message.reaction.emoji}
                </div>
            )}
        </div>
    );
});
