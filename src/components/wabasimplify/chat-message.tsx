
'use client';

import React, { useState } from 'react';
import { handleTranslateMessage } from '@/app/actions';
import type { AnyMessage, OutgoingMessage } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, Download, File as FileIcon, Image as ImageIcon, XCircle, Languages, LoaderCircle } from 'lucide-react';
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

    if (type === 'video') {
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
        return <div className="text-sm text-muted-foreground italic">[Audio message]</div>;
    }

    if (type === 'sticker') {
        return <div className="text-sm text-muted-foreground italic">[Sticker]</div>;
    }
    
    return <div className="text-sm text-muted-foreground italic">[{type} message]</div>;
};

const MessageBody = ({ message, isOutgoing }: { message: AnyMessage; isOutgoing: boolean }) => {
    // Outgoing message from bot with buttons
    if (isOutgoing && message.type === 'interactive' && message.content.interactive?.type === 'button') {
        const interactive = message.content.interactive;
        return (
            <div>
                <p className="whitespace-pre-wrap">{interactive.body.text}</p>
                <div className="mt-2 pt-2 border-t border-black/10 space-y-1">
                    {interactive.action.buttons.map((btn: any, index: number) => (
                        <div key={index} className="text-center bg-white/50 rounded-md py-1.5 text-sm font-medium text-blue-500">
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


export const ChatMessage = React.memo(function ChatMessage({ message }: ChatMessageProps) {
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
            <div
                className={cn(
                    "max-w-md rounded-lg p-2 text-sm flex flex-col shadow-sm",
                    isOutgoing
                        ? "bg-[#dcf8c6] dark:bg-[#005c4b] text-foreground"
                        : "bg-white dark:bg-muted"
                )}
            >
                <MessageBody message={message} isOutgoing={isOutgoing} />

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
        </div>
    );
});
