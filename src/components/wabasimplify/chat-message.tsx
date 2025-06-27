
'use client';

import { AnyMessage, OutgoingMessage } from '@/app/actions';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, Download, File as FileIcon, Image as ImageIcon, Video as VideoIcon, XCircle } from 'lucide-react';
import Image from 'next/image';

interface ChatMessageProps {
    message: AnyMessage;
}

function StatusTicks({ status }: { status: OutgoingMessage['status'] }) {
    if (status === 'failed') {
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
    if (status === 'read') {
        return <CheckCheck className="h-4 w-4 text-blue-400" />;
    }
    if (status === 'delivered') {
        return <CheckCheck className="h-4 w-4" />;
    }
    if (status === 'sent') {
        return <Check className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />; // for 'pending'
}

function MediaContent({ message }: { message: AnyMessage }) {
    const content = message.content;
    const type = content.type;
    const media = content[type]; // e.g., content.image

    if (!media) return <div className="text-sm text-muted-foreground italic">[Unsupported media]</div>;

    const url = media.link || `https://placehold.co/300x200.png`; // Placeholder for media without a link after sending
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
    
    return <div className="text-sm text-muted-foreground italic">[{type} media]</div>;
}


export function ChatMessage({ message }: ChatMessageProps) {
    const isOutgoing = message.direction === 'out';
    const timestamp = message.messageTimestamp || message.createdAt;

    return (
        <div className={cn("flex items-end gap-2", isOutgoing ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-md rounded-lg p-3 text-sm flex flex-col",
                    isOutgoing
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                )}
            >
                {message.type === 'text' ? (
                     <p className="whitespace-pre-wrap">{message.content.text.body}</p>
                ) : (
                    <MediaContent message={message} />
                )}

                {isOutgoing && message.status === 'failed' && (
                    <p className="text-xs mt-1 pt-1 border-t border-primary-foreground/20 text-red-300">
                        Failed: {message.error}
                    </p>
                )}

                <div className="flex items-center gap-2 self-end mt-1 pt-1 opacity-80">
                    <p className="text-xs">
                        {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isOutgoing && <StatusTicks status={(message as OutgoingMessage).status} />}
                </div>
            </div>
        </div>
    );
}
