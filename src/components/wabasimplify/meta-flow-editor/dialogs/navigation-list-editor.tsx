
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { ActionEditor } from '../shared/action-editor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import { Separator } from '@/components/ui/separator';

interface NavigationListEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function NavigationListEditor({ component, updateField }: NavigationListEditorProps) {
    const listItems = component['list-items'] || [];

    const updateListItems = (newListItems: any[]) => {
        updateField('list-items', newListItems);
    };

    const handleAddItem = () => {
        const newItem = { id: uuidv4(), 'main-content': { title: '', description: '', metadata: '' } };
        updateListItems([...listItems, newItem]);
    };

    const handleRemoveItem = (index: number) => {
        const newListItems = listItems.filter((_: any, i: number) => i !== index);
        updateListItems(newListItems);
    };

    const handleItemChange = (index: number, path: string, value: any) => {
        const newListItems = JSON.parse(JSON.stringify(listItems));
        const keys = path.split('.');
        let current = newListItems[index];
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        updateListItems(newListItems);
    };
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="label">Label (Title)</Label>
                <Input id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={component.description || ''} onChange={(e) => updateField('description', e.target.value)} />
            </div>

            <Separator />
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <Label className="font-semibold">List Items</Label>
                    <Button type="button" size="sm" variant="outline" onClick={handleAddItem}>
                        <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </div>
                <ScrollArea className="max-h-[40vh] space-y-3 pr-4">
                    {listItems.map((item: any, index: number) => (
                        <div key={item.id || index} className="p-4 border rounded-lg space-y-3 bg-muted/50 mb-3 relative">
                             <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            
                            <h4 className="font-medium">Item {index + 1}</h4>
                             <div className="space-y-2">
                                <Label htmlFor={`item-id-${index}`}>ID</Label>
                                <Input id={`item-id-${index}`} value={item.id} onChange={(e) => handleItemChange(index, 'id', e.target.value)} required />
                            </div>
                            <div className="p-3 border rounded-md bg-background">
                                <h5 className="text-sm font-semibold mb-2">Main Content</h5>
                                <div className="space-y-2">
                                    <Input placeholder="Title" value={item['main-content']?.title || ''} onChange={e => handleItemChange(index, 'main-content.title', e.target.value)} />
                                    <Input placeholder="Description" value={item['main-content']?.description || ''} onChange={e => handleItemChange(index, 'main-content.description', e.target.value)} />
                                    <Input placeholder="Metadata" value={item['main-content']?.metadata || ''} onChange={e => handleItemChange(index, 'main-content.metadata', e.target.value)} />
                                </div>
                            </div>
                             <div className="p-3 border rounded-md bg-background">
                                <h5 className="text-sm font-semibold mb-2">Start Content (Optional)</h5>
                                <div className="space-y-2">
                                    <Input placeholder="Image (Base64)" value={item.start?.image || ''} onChange={e => handleItemChange(index, 'start.image', e.target.value)} />
                                    <Input placeholder="Alt Text" value={item.start?.['alt-text'] || ''} onChange={e => handleItemChange(index, 'start.alt-text', e.target.value)} />
                                </div>
                            </div>
                            <div className="p-3 border rounded-md bg-background">
                                <h5 className="text-sm font-semibold mb-2">End Content (Optional)</h5>
                                <div className="space-y-2">
                                    <Input placeholder="Title" value={item.end?.title || ''} onChange={e => handleItemChange(index, 'end.title', e.target.value)} />
                                    <Input placeholder="Description" value={item.end?.description || ''} onChange={e => handleItemChange(index, 'end.description', e.target.value)} />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor={`badge-${index}`}>Badge (Optional)</Label>
                                <Input id={`badge-${index}`} value={item.badge || ''} onChange={(e) => handleItemChange(index, 'badge', e.target.value)} />
                            </div>
                            <ActionEditor label="On Click Action" action={item['on-click-action']} onActionChange={(action) => handleItemChange(index, 'on-click-action', action)} actionType="on-click-action" />
                        </div>
                    ))}
                </ScrollArea>
            </div>
        </div>
    );
}
