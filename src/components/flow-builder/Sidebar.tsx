import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
    MessageSquare,
    ImageIcon,
    ToggleRight,
    Type,
    Clock,
    GitFork,
    Code,
    Send,
    Bot,
    Smartphone,
    Mail,
    UserPlus,
    Link as LinkIcon,
    QrCode,
} from 'lucide-react';

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'condition', label: 'Condition', icon: GitFork },
    { type: 'api', label: 'Call API', icon: Code },
    { type: 'sendTemplate', label: 'Send Template', icon: Send },
    { type: 'triggerMetaFlow', label: 'Trigger Meta Flow', icon: Bot },
    { type: 'sendSms', label: 'Send SMS', icon: Smartphone },
    { type: 'sendEmail', label: 'Send Email', icon: Mail },
    { type: 'createCrmLead', label: 'Create CRM Lead', icon: UserPlus },
    { type: 'generateShortLink', label: 'Create Short Link', icon: LinkIcon },
    { type: 'generateQrCode', label: 'Generate QR Code', icon: QrCode },
];

export const Sidebar = () => {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <Card className="h-full border-r rounded-none border-y-0 border-l-0 flex flex-col">
            <CardHeader className="p-4 border-b shrink-0">
                <CardTitle className="text-sm font-semibold">Blocks</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 w-full">
                <div className="p-4 grid gap-2 pb-10">
                    {blockTypes.map((block) => {
                        const Icon = block.icon;
                        return (
                            <div
                                key={block.type}
                                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-grab active:cursor-grabbing transition-colors"
                                onDragStart={(event) => onDragStart(event, block.type)}
                                draggable
                            >
                                <div className="p-2 rounded-md bg-muted">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm font-medium">{block.label}</span>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </Card>
    );
};
