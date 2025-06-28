
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    Image as ImageIcon,
    Play,
    Trash2,
    Save,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type NodeType = 'start' | 'text' | 'buttons' | 'condition' | 'webhook' | 'image';

type NodeData = {
    label?: string;
    text?: string;
    buttons?: { text: string }[];
    condition?: string;
    url?: string;
    imageUrl?: string;
};

type Node = {
    id: string;
    type: NodeType;
    data: NodeData;
    position: { x: number; y: number };
};

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
    { type: 'webhook', label: 'Call Webhook', icon: Webhook },
];

const NodeComponent = ({ node, onSelectNode, isSelected }: { node: Node; onSelectNode: (id: string) => void; isSelected: boolean }) => {
    const BlockIcon = blockTypes.find(b => b.type === node.type)?.icon || MessageSquare;

    return (
        <div 
            className={cn(
                "absolute cursor-pointer transition-all",
                isSelected ? "z-10" : "z-0"
            )}
            style={{ top: node.position.y, left: node.position.x }}
            onClick={() => onSelectNode(node.id)}
        >
            <Card className={cn(
                "w-64 hover:shadow-xl hover:-translate-y-1",
                isSelected && "ring-2 ring-primary shadow-2xl"
            )}>
                <CardHeader className="flex flex-row items-center gap-3 p-3">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{node.data.label}</CardTitle>
                </CardHeader>
            </Card>
        </div>
    );
};

const BlockPalette = ({ onAddNode }: { onAddNode: (type: NodeType) => void }) => (
    <Card>
        <CardHeader>
            <CardTitle>Blocks</CardTitle>
            <CardDescription>Drag or click to add blocks to the canvas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
            {blockTypes.map(({ type, label, icon: Icon }) => (
                <Button key={type} variant="outline" className="w-full justify-start" onClick={() => onAddNode(type)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                </Button>
            ))}
        </CardContent>
    </Card>
);

const PropertiesPanel = ({ selectedNode, updateNodeData, deleteNode }: { selectedNode: Node | null; updateNodeData: (id: string, data: Partial<NodeData>) => void, deleteNode: (id: string) => void }) => {
    
    if (!selectedNode) {
        return (
            <Card className="h-full">
                <CardContent className="flex h-full items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground text-center">Select a block to see its properties.</p>
                </CardContent>
            </Card>
        );
    }
    
    const handleDataChange = (field: keyof NodeData, value: any) => {
        updateNodeData(selectedNode.id, { [field]: value });
    };

    const handleButtonChange = (index: number, value: string) => {
        const newButtons = [...(selectedNode.data.buttons || [])];
        newButtons[index] = { text: value };
        handleDataChange('buttons', newButtons);
    };
    
    const addEmptyButton = () => {
        const newButtons = [...(selectedNode.data.buttons || []), { text: '' }];
        handleDataChange('buttons', newButtons);
    };

    const removeButton = (index: number) => {
        const newButtons = (selectedNode.data.buttons || []).filter((_, i) => i !== index);
        handleDataChange('buttons', newButtons);
    };

    const renderProperties = () => {
        switch (selectedNode.type) {
            case 'start':
                return <p className="text-sm text-muted-foreground">This is the starting point of your flow.</p>;
            case 'text':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="text-content">Message Text</Label>
                        <Textarea 
                            id="text-content" 
                            placeholder="Enter your message here..." 
                            value={selectedNode.data.text || ''}
                            onChange={(e) => handleDataChange('text', e.target.value)}
                            className="h-32"
                        />
                    </div>
                );
            case 'buttons':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="buttons-text">Message Text</Label>
                            <Textarea 
                                id="buttons-text" 
                                placeholder="What would you like to do?"
                                value={selectedNode.data.text || ''}
                                onChange={(e) => handleDataChange('text', e.target.value)}
                                className="h-24"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Buttons</Label>
                            {(selectedNode.data.buttons || []).map((btn, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input 
                                        placeholder={`Button ${index + 1}`} 
                                        value={btn.text}
                                        onChange={(e) => handleButtonChange(index, e.target.value)}
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => removeButton(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={addEmptyButton}>
                                <Plus className="mr-2 h-4 w-4" /> Add Button
                            </Button>
                        </div>
                    </div>
                );
            case 'image':
                 return (
                    <div className="space-y-2">
                        <Label htmlFor="image-url">Image URL</Label>
                        <Input 
                            id="image-url" 
                            placeholder="https://example.com/image.png"
                            value={selectedNode.data.imageUrl || ''}
                            onChange={(e) => handleDataChange('imageUrl', e.target.value)}
                        />
                    </div>
                );
            case 'condition':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="condition-logic">Condition</Label>
                        <Textarea 
                            id="condition-logic"
                            placeholder="e.g., last_user_message CONTAINS 'price'"
                            value={selectedNode.data.condition || ''}
                            onChange={(e) => handleDataChange('condition', e.target.value)}
                            className="h-24"
                        />
                    </div>
                );
            case 'webhook':
                 return (
                    <div className="space-y-2">
                        <Label htmlFor="webhook-url">Webhook URL</Label>
                        <Input 
                            id="webhook-url" 
                            placeholder="https://api.example.com/data"
                            value={selectedNode.data.url || ''}
                            onChange={(e) => handleDataChange('url', e.target.value)}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Properties</CardTitle>
                <CardDescription>Configure the '{selectedNode.data.label}' block.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 overflow-y-auto">
                <div className="space-y-2">
                    <Label htmlFor="node-label">Block Label</Label>
                    <Input 
                        id="node-label" 
                        value={selectedNode.data.label || ''}
                        onChange={(e) => handleDataChange('label', e.target.value)}
                    />
                </div>
                <Separator />
                {renderProperties()}
            </CardContent>
            {selectedNode.type !== 'start' && (
                <CardFooter className="border-t pt-4">
                     <Button variant="destructive" className="w-full" onClick={() => deleteNode(selectedNode.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Block
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
};

export default function FlowBuilderPage() {
    const { toast } = useToast();
    const [flowName, setFlowName] = useState('New Product Inquiry Flow');
    const [nodes, setNodes] = useState<Node[]>([
        { id: 'node-start', type: 'start', data: { label: 'Start Flow' }, position: { x: 50, y: 150 } },
    ]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    useEffect(() => {
        document.title = 'Flow Builder | Wachat';
    }, []);

    const addNode = (type: NodeType) => {
        const newNode: Node = {
            id: `node-${type}-${Date.now()}`,
            type,
            data: { label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}` },
            position: { x: Math.random() * 400 + 200, y: Math.random() * 200 + 50 },
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    };
    
    const updateNodeData = (id: string, data: Partial<NodeData>) => {
        setNodes(prev => prev.map(node => 
            node.id === id ? { ...node, data: { ...node.data, ...data } } : node
        ));
    };
    
    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        setSelectedNodeId(null);
    };

    const saveFlow = () => {
        console.log("Saving flow:", { name: flowName, nodes });
        toast({
            title: "Flow Saved!",
            description: `The flow "${flowName}" has been saved successfully.`,
        });
    };
    
    const selectedNode = nodes.find(node => node.id === selectedNodeId) || null;

    return (
        <div className="flex flex-col h-[calc(100vh-150px)] gap-4">
            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Flow Builder</h1>
                    <Input 
                        value={flowName} 
                        onChange={e => setFlowName(e.target.value)} 
                        className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">Test Flow</Button>
                    <Button onClick={saveFlow}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Flow
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
                <div className="md:col-span-2">
                    <BlockPalette onAddNode={addNode} />
                </div>
                <div className="md:col-span-7">
                    <Card className="h-full">
                        <ScrollArea className="h-full">
                            <div className="relative h-[80vh]">
                                {nodes.map(node => (
                                    <NodeComponent 
                                        key={node.id} 
                                        node={node}
                                        onSelectNode={setSelectedNodeId}
                                        isSelected={selectedNodeId === node.id}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>
                <div className="md:col-span-3">
                    <PropertiesPanel 
                        selectedNode={selectedNode}
                        updateNodeData={updateNodeData}
                        deleteNode={deleteNode}
                    />
                </div>
            </div>
        </div>
    );
}

