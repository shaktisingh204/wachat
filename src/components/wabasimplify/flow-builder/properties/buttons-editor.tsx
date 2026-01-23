
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function ButtonsEditor({ node, onUpdate }: EditorProps) {
    const { toast } = useToast();

    const handleButtonChange = (index: number, field: 'text', value: string) => {
        const newButtons = [...(node.data.buttons || [])];
        newButtons[index] = { ...newButtons[index], [field]: value };
        onUpdate({ ...node.data, buttons: newButtons });
    };

    const addFlowButton = () => {
        const currentButtons = node.data.buttons || [];
        if (currentButtons.length >= 3) {
            toast({ title: "Limit Reached", description: "You can add a maximum of 3 Quick Reply buttons.", variant: "destructive" });
            return;
        }
        const newButtons = [...currentButtons, { id: `btn-${Date.now()}`, text: '', type: 'QUICK_REPLY' }];
        onUpdate({ ...node.data, buttons: newButtons });
    };

    const removeFlowButton = (index: number) => {
        const newButtons = (node.data.buttons || []).filter((_: any, i: number) => i !== index);
        onUpdate({ ...node.data, buttons: newButtons });
    };
    
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="buttons-text">Message Text</Label>
                <Textarea id="buttons-text" placeholder="Choose an option:" value={node.data.text || ''} onChange={(e) => onUpdate({ ...node.data, text: e.target.value })} />
            </div>
            <div className="space-y-2">
                <Label>Buttons</Label>
                <div className="space-y-3">
                    {(node.data.buttons || []).map((btn: any, index: number) => (
                        <div key={btn.id || index} className="flex items-center gap-2">
                            <Input 
                                placeholder="Button Text" 
                                value={btn.text} 
                                onChange={(e) => handleButtonChange(index, 'text', e.target.value)} 
                                maxLength={20}
                            />
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFlowButton(index)}><Trash2 className="h-3 w-3"/></Button>
                        </div>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addFlowButton}><Plus className="mr-2 h-4 w-4"/>Add Button</Button>
            </div>
        </div>
    );
}
