
'use client';

import {
    StartEditor,
    TextEditor,
    ImageEditor,
    ButtonsEditor,
    InputEditor,
    DelayEditor,
    ConditionEditor,
    ApiEditor,
    SendTemplateEditor,
    TriggerMetaFlowEditor,
    SmsEditor,
    EmailEditor,
    CrmLeadEditor,
    ShortLinkEditor,
    QrCodeEditor,
} from './flow-builder/properties';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Settings2 } from 'lucide-react';

interface PropertiesPanelProps {
    node: any;
    availableVariables: any[];
    onUpdate: (id: string, data: Partial<any>) => void;
    deleteNode: (id: string) => void;
}

export function PropertiesPanel({ node, availableVariables, onUpdate, deleteNode }: PropertiesPanelProps) {
    if (!node) {
        return <div className="p-4 text-center text-sm text-muted-foreground">Select a block to see its properties.</div>;
    }

    const handleDataChange = (data: Partial<any>) => {
        onUpdate(node.id, data);
    };

    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(node.id, { label: e.target.value });
    };

    const renderEditorContent = () => {
        const editorProps = { node, onUpdate: handleDataChange, availableVariables };

        switch (node.type) {
            case 'start': return <StartEditor {...editorProps} />;
            case 'text': return <TextEditor {...editorProps} />;
            case 'image': return <ImageEditor {...editorProps} />;
            case 'buttons': return <ButtonsEditor {...editorProps} />;
            case 'input': return <InputEditor {...editorProps} />;
            case 'delay': return <DelayEditor {...editorProps} />;
            case 'condition': return <ConditionEditor {...editorProps} />;
            case 'api': return <ApiEditor {...editorProps} />;
            case 'sendTemplate': return <SendTemplateEditor {...editorProps} />;
            case 'triggerMetaFlow': return <TriggerMetaFlowEditor {...editorProps} />;
            case 'sendSms': return <SmsEditor {...editorProps} />;
            case 'sendEmail': return <EmailEditor {...editorProps} />;
            case 'createCrmLead': return <CrmLeadEditor {...editorProps} />;
            case 'generateShortLink': return <ShortLinkEditor {...editorProps} />;
            case 'generateQrCode': return <QrCodeEditor {...editorProps} />;
            default:
                return <p className="text-sm text-muted-foreground italic">No properties to configure for this block type.</p>;
        }
    }

    return (
        <div className="flex flex-col h-full bg-background/50 backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-background/80">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    Block Properties
                </h3>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    <div className="space-y-3">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">General</Label>
                        <div className="grid gap-2">
                            <Label htmlFor="block-label">Block Label</Label>
                            <Input
                                id="block-label"
                                value={node.data.label}
                                onChange={handleLabelChange}
                                placeholder="Enter a label for this block"
                                className="bg-background"
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Configuration</Label>
                        <div className="space-y-4">
                            {renderEditorContent()}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {node.type !== 'start' && (
                <div className="p-4 border-t bg-background/50 mt-auto shrink-0">
                    <Button
                        variant="ghost"
                        className="w-full hover:bg-destructive/10 hover:text-destructive transition-colors text-destructive"
                        onClick={() => deleteNode(node.id)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Block
                    </Button>
                </div>
            )}
        </div>
    );
}
