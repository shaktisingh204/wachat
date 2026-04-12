import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
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
    Play,
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
    { type: 'start', label: 'Start Flow', icon: Play },
];

const NodePreview = ({ data, type }: { data: any; type: string }) => {
    const renderTextWithVariables = (text?: string) => {
        if (!text) return <span className="italic opacity-50">Enter message...</span>;
        // Basic regex for {{variable}} highlighting
        // Note: React Flow nodes are rendered often, keep this lightweight
        return text;
    };

    switch (type) {
        case 'text':
        case 'input':
            return <p className="whitespace-pre-wrap text-xs line-clamp-3">{renderTextWithVariables(data.text)}</p>;
        case 'image':
            return (
                <div className="space-y-1">
                    <div className="aspect-video bg-muted/50 rounded-md flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    {data.caption && <p className="text-xs truncate">{data.caption}</p>}
                </div>
            );
        case 'buttons':
            return (
                <div className="space-y-1">
                    <p className="text-xs line-clamp-2">{data.text || 'Question text...'}</p>
                    <div className="space-y-1 pt-1">
                        {((data.buttons as any[]) || []).map((btn: any, i: number) => (
                            <div key={i} className="text-[10px] text-center bg-muted rounded px-1 py-0.5 truncate">
                                {btn.text || `Button ${i + 1}`}
                            </div>
                        ))}
                    </div>
                </div>
            );
        default:
            return null;
    }
};

const CustomNode = ({ data, type, selected }: NodeProps) => {
    const blockInfo = blockTypes.find((b) => b.type === type) || blockTypes[0];
    const Icon = blockInfo.icon;

    return (
        <div className="relative">
            <Card
                className={cn(
                    'w-64 shadow-md transition-all duration-200',
                    selected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-lg'
                )}
            >
                <CardHeader className="flex flex-row items-center gap-3 p-3 pb-2 space-y-0">
                    <div className={cn("p-1.5 rounded-md bg-muted", selected && "bg-primary/10 text-primary")}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-medium leading-none">
                        {(data.label as any) || blockInfo.label}
                    </CardTitle>
                </CardHeader>

                {(type === 'text' || type === 'image' || type === 'input' || type === 'buttons') && (
                    <CardContent className="p-3 pt-0">
                        <div className="rounded-md bg-muted/30 p-2 text-sm text-muted-foreground">
                            <NodePreview data={data} type={type} />
                        </div>
                    </CardContent>
                )}

                {/* Handles */}
                {type !== 'start' && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        className="w-3 h-3 bg-muted-foreground border-2 border-background"
                    />
                )}

                {type === 'condition' ? (
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                        <div className="relative">
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="output-yes"
                                className="w-3 h-3 bg-green-500 border-2 border-background !right-0 !relative !transform-none"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 bg-background px-1 rounded shadow-sm border">YES</span>
                        </div>
                        <div className="relative">
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="output-no"
                                className="w-3 h-3 bg-red-500 border-2 border-background !right-0 !relative !transform-none"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-600 bg-background px-1 rounded shadow-sm border">NO</span>
                        </div>
                    </div>
                ) : type === 'buttons' ? (
                    <div className="absolute -right-3 top-12 flex flex-col gap-2">
                        {((data.buttons as any[]) || []).map((btn: any, i: number) => (
                            <div key={i} className="relative h-6 flex items-center">
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`btn-${i}`}
                                    className="w-3 h-3 bg-primary border-2 border-background !right-0 !relative !transform-none"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="output-main"
                        className="w-3 h-3 bg-muted-foreground border-2 border-background"
                    />
                )}
            </Card>
        </div>
    );
};

export default memo(CustomNode);
