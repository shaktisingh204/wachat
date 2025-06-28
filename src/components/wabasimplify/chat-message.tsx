
'use client';

import { useState } from 'react';
import { AnyMessage, OutgoingMessage, handleTranslateMessage } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, Download, File as FileIcon, Video as VideoIcon, XCircle, Languages, LoaderCircle } from 'lucide-react';
import Image from 'next/image';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface ChatMessageProps {
    message: AnyMessage;
}

function StatusTicks({ message }: { message: OutgoingMessage }) {
    const { status, statusTimestamps } = message;

    const getIcon = () => {
        switch (status) {
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-400" />;
            case 'read':
                return <CheckCheck className="h-4 w-4 text-blue-400" />;
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
                    <span>{getIcon()}</span>
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
    
    // For outgoing media, the link isn't immediately available, so we use a placeholder logic.
    // For incoming, the link needs to be requested from Meta via another API call not implemented here.
    const url = media.link || `https://placehold.co/300x200.png`; 
    const caption = media.caption || '';
    const fileName = media.filename || 'download';
    
    if (type === 'image') {
        return (
            <div className="space-y-2">
                <a href={url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video w-64 bg-muted rounded-lg overflow-hidden">
                    <Image src={url} alt={caption || 'Sent image'} layout="fill" objectFit="cover" data-ai-hint="chat image" />
                </a>
                {caption && <p className="text-sm">{caption}</p>}
            </div>
        );
    }

    if (type === 'video') {
         return (
            <div className="space-y-2 w-64">
                <video controls src={url} className="rounded-lg aspect-video w-full bg-black" />
                {caption && <p className="text-sm">{caption}</p>}
            </div>
        );
    }

    if (type === 'document') {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-background transition-colors max-w-xs">
                <FileIcon className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                    <p className="font-semibold truncate">{fileName}</p>
                    {caption && <p className="text-xs text-muted-foreground truncate">{caption}</p>}
                </div>
                <Download className="h-5 w-5 text-muted-foreground" />
            </a>
        );
    }

    if (type === 'audio') {
        return <div className="text-sm text-muted-foreground italic">[Audio message]</div>;
    }

    if (type === 'sticker') {
        return <div className="text-sm text-muted-foreground italic">[Sticker]</div>;
    }
    
    return <div className="text-sm text-muted-foreground italic">[{type} message]</div>;
}

const MessageBody = ({ message, isOutgoing }: { message: AnyMessage; isOutgoing: boolean }) => {
    // Outgoing message from bot with buttons
    if (isOutgoing && message.type === 'interactive' && message.content.interactive?.type === 'button') {
        const interactive = message.content.interactive;
        return (
            <div>
                <p className="whitespace-pre-wrap">{interactive.body.text}</p>
                <div className="mt-2 pt-2 border-t border-primary-foreground/20 space-y-1">
                    {interactive.action.buttons.map((btn: any, index: number) => (
                        <div key={index} className="text-center bg-primary-foreground/10 rounded-md py-1.5 text-sm font-medium">
                            {btn.reply.title}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    // Incoming interactive reply
    if (!isOutgoing && message.type === 'interactive' && message.content.interactive?.button_reply?.title) {
        return <p className="whitespace-pre-wrap">{message.content.interactive.button_reply.title}</p>;
    }
    
    // Standard text message
    if (message.type === 'text' && message.content.text?.body) {
        return <p className="whitespace-pre-wrap">{message.content.text.body}</p>;
    }

    // Media and other types
    return <MediaContent message={message} />;
};


export function ChatMessage({ message }: ChatMessageProps) {
    const isOutgoing = message.direction === 'out';
    const timestamp = message.messageTimestamp || message.createdAt;
    
    const [translatedText, setTranslatedText] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const { toast } = useToast();

    const onTranslate = async () => {
        let originalText = message.content.text?.body;
        if (!originalText && message.type === 'interactive') {
            originalText = message.content.interactive?.button_reply?.title;
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
    
    return (
        <div className={cn("flex items-end gap-2 group/message", isOutgoing ? "justify-end" : "justify-start")}>
            
            {!isOutgoing && (
                <div className="self-center opacity-0 group-hover/message:opacity-100 transition-opacity">
                    {(message.type === 'text' || message.type === 'interactive') && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTranslate} disabled={isTranslating}>
                                        {isTranslating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                                        <span className="sr-only">Translate</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Translate to English</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            )}

            <div
                className={cn(
                    "max-w-md rounded-lg p-3 text-sm flex flex-col",
                    isOutgoing
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                )}
            >
                <MessageBody message={message} isOutgoing={isOutgoing} />

                {translatedText && (
                    <>
                        <Separator className={cn("my-2", isOutgoing ? "bg-primary-foreground/20" : "bg-muted-foreground/20")} />
                        <p className={cn("whitespace-pre-wrap italic", isOutgoing ? "text-primary-foreground/90" : "text-muted-foreground")}>{translatedText}</p>
                    </>
                )}


                {isOutgoing && message.status === 'failed' && (
                    <p className="text-xs mt-1 pt-1 border-t border-primary-foreground/20 text-red-300">
                        Failed: {message.error}
                    </p>
                )}

                <div className={cn("flex items-center gap-2 self-end mt-1 pt-1", isOutgoing ? 'opacity-80' : 'opacity-60')}>
                    <p className="text-xs">
                        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isOutgoing && <StatusTicks message={message as OutgoingMessage} />}
                </div>
            </div>
        </div>
    );
}
