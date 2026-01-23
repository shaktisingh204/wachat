
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
import { Trash2 } from 'lucide-react';

interface PropertiesPanelProps {
    node: any;
    onUpdate: (id: string, data: Partial<any>) => void;
    deleteNode: (id: string) => void;
}

export function PropertiesPanel({ node, onUpdate, deleteNode }: PropertiesPanelProps) {
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
        const editorProps = { node, onUpdate: handleDataChange };

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
        <div className="space-y-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold">Properties</h3>
            <div className="space-y-2">
                <Label>Block Label</Label>
                <Input value={node.data.label} onChange={handleLabelChange} />
            </div>
            <Separator />
            <div className="flex-1">
                {renderEditorContent()}
            </div>
            {node.type !== 'start' && (
                <Button variant="destructive" className="w-full" onClick={() => deleteNode(node.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Block
                </Button>
            )}
        </div>
    );
}
