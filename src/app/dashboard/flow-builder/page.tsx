
'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    MessageSquare, 
    ToggleRight, 
    GitFork, 
    Webhook, 
    ImageIcon,
    Play,
    Trash2,
    Save,
    Plus,
    Clock,
    Type,
    BrainCircuit,
    ArrowRightLeft,
    ShoppingCart,
    View,
    Server,
    Variable,
    File,
    LoaderCircle,
    BookOpen,
    PanelLeft,
    Settings2,
    Copy,
    ServerCog,
    FileText as FileTextIcon,
    ZoomIn,
    ZoomOut,
    Frame,
    Maximize,
    Minimize,
    CreditCard
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProjects, getFlowLogById } from '@/app/actions';
import { getTemplates } from '@/app/actions/whatsapp.actions';
import { saveFlow, getFlowById, getFlowsForProject, deleteFlow } from '@/app/actions/flow.actions';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { Flow, FlowNode, FlowEdge, Template, MetaFlow } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TestFlowDialog } from '@/components/wabasimplify/test-flow-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { generateFlowBuilderFlow } from '@/ai/flows/generate-flow-builder-flow';


type NodeType = 'start' | 'text' | 'buttons' | 'condition' | 'webhook' | 'image' | 'input' | 'delay' | 'api' | 'carousel' | 'addToCart' | 'language' | 'sendTemplate' | 'triggerMetaFlow' | 'triggerFlow' | 'payment';

type ButtonConfig = {
    id: string;
    type: 'QUICK_REPLY';
    text: string;
};

type CarouselSection = {
    title: string;
    products: { product_retailer_id: string }[];
};

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'carousel', label: 'Carousel', icon: View },
    { type: 'payment', label: 'Request Payment', icon: CreditCard },
    { type: 'language', label: 'Set Language', icon: BrainCircuit },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'api', label: 'Call API', icon: ArrowRightLeft },
    { type: 'sendTemplate', label: 'Send Template', icon: FileTextIcon },
    { type: 'triggerMetaFlow', label: 'Trigger Meta Flow', icon: ServerCog },
    { type: 'triggerFlow', label: 'Trigger Flow', icon: GitFork },
];

const NodePreview = ({ node }: { node: FlowNode }) => {
    const renderTextWithVariables = (text: string) => {
        if (!text) return null;
        const parts = text.split(/({{\s*[\w\d._]+\s*}})/g);
        return parts.map((part, i) =>
            part.match(/^{{.*}}$/) ? (
                <span key={i} className="font-semibold text-primary/90 bg-primary/10 rounded-sm px-1">
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

    const previewContent = () => {
        switch (node.type) {
            case 'text':
                return <p className="whitespace-pre-wrap">{renderTextWithVariables(node.data.text) || <span className="italic opacity-50">Enter message...</span>}</p>;
            case 'image':
                return (
                    <div className="space-y-1">
                        <div className="aspect-video bg-background/50 rounded-md flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-foreground/20" />
                        </div>
                        {node.data.caption && <p className="whitespace-pre-wrap text-xs">{renderTextWithVariables(node.data.caption)}</p>}
                    </div>
                );
            case 'buttons':
                return (
                    <div className="space-y-2">
                        <p className="whitespace-pre-wrap">{renderTextWithVariables(node.data.text) || <span className="italic opacity-50">Enter message...</span>}</p>
                        <div className="space-y-1 mt-2 border-t border-muted-foreground/20 pt-2">
                            {(node.data.buttons || []).map((btn: any, index: number) => (
                                <div key={btn.id || index} className="text-center text-primary font-medium bg-background/50 py-1.5 rounded-md text-xs">
                                    {btn.text || `Button ${index + 1}`}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'sendTemplate':
                 return <p className="text-xs text-muted-foreground italic">Sends template: {node.data.templateName || 'None selected'}</p>;
            case 'triggerMetaFlow':
                 return <p className="text-xs text-muted-foreground italic">Triggers flow: {node.data.metaFlowName || 'None selected'}</p>;
            case 'triggerFlow':
                 return <p className="text-xs text-muted-foreground italic">Triggers flow: {node.data.flowName || 'None selected'}</p>;
            case 'payment':
                 return <p className="text-xs text-muted-foreground italic">Request payment of {node.data.paymentAmount || '0'} INR</p>;
            default:
                return null;
        }
    };

    const content = previewContent();
    if (!content) return null;

    return (
        <CardContent className="p-2 pt-0">
            <div className="bg-muted p-2 rounded-lg text-sm text-card-foreground/80">
                {content}
            </div>
        </CardContent>
    );
};


const NodeComponent = ({ 
    node, 
    onSelectNode, 
    isSelected,
    onNodeMouseDown,
    onHandleClick 
}: { 
    node: FlowNode; 
    onSelectNode: (id: string) => void; 
    isSelected: boolean;
    onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string) => void;
}) => {
    const BlockIcon = [...blockTypes, {type: 'start', label: 'Start', icon: Play}].find(b => b.type === node.type)?.icon || MessageSquare;

    const Handle = ({ position, id, style, children }: { position: 'left' | 'right' | 'top' | 'bottom', id: string, style?: React.CSSProperties, children?: React.ReactNode }) => (
        <div 
            id={id}
            style={style}
            data-handle-pos={position}
            className={cn(
                "absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 flex items-center justify-center",
                position === 'left' && "-left-2 top-1/2 -translate-y-1/2",
                position === 'right' && "-right-2 top-1/2 -translate-y-1/2",
            )} 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onHandleClick(e, node.id, id); }}
        >
            {children}
        </div>
    );

    return (
        <div 
            className="absolute cursor-grab active:cursor-grabbing transition-all"
            style={{ top: node.position.y, left: node.position.x }}
            onMouseDown={(e) => onNodeMouseDown(e, node.id)}
            onClick={(e) => {e.stopPropagation(); onSelectNode(node.id)}}
        >
            <Card className={cn(
                "w-64 hover:shadow-xl hover:-translate-y-1 bg-card",
                isSelected && "ring-2 ring-primary shadow-2xl"
            )}>
                <CardHeader className="flex flex-row items-center gap-3 p-3">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{node.data.label}</CardTitle>
                </CardHeader>
                 
                <NodePreview node={node} />

                 {node.type === 'condition' && (
                    <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center"><span>Yes</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between items-center"><span>No</span></div>
                    </CardContent>
                )}
                 {node.type === 'payment' && (
                    <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center"><span>Success</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between items-center"><span>Failure</span></div>
                    </CardContent>
                )}
            </Card>

            {node.type !== 'start' && <Handle position="left" id={`${node.id}-input`} />}
            
            {node.type === 'condition' || node.type === 'payment' ? (
                <>
                    <Handle position="right" id={`${node.id}-output-yes`} style={{ top: '33.33%' }} />
                    <Handle position="right" id={`${node.id}-output-no`} style={{ top: '66.67%' }} />
                </>
            ) : node.type === 'buttons' ? (
                (node.data.buttons || []).map((btn: ButtonConfig, index: number) => {
                    const totalButtons = node.data.buttons.length;
                    const topPosition = totalButtons > 1 ? `${(100 / (totalButtons + 1)) * (index + 1)}%` : '50%';
                    return <Handle key={btn.id || index} position="right" id={`${node.id}-btn-${index}`} style={{ top: topPosition }} />;
                })
            ) : (
                 node.type !== 'addToCart' && <Handle position="right" id={`${node.id}-output-main`} />
            )}
        </div>
    );
};
// Other components and functions (PropertiesPanel, FlowsAndBlocksPanel, etc.)
// These will be defined below and are assumed to be correct for this fix.
