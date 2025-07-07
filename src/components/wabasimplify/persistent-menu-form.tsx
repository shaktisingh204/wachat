
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LoaderCircle, Plus, Save, Trash2, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { savePersistentMenu } from '@/app/actions/facebook.actions';
import type { WithId, EcommShop } from '@/lib/definitions';
import { Separator } from '../ui/separator';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Menu
    </Button>
  );
}

interface PersistentMenuFormProps {
    shop: WithId<EcommShop>;
}

type MenuItem = {
    type: 'postback' | 'web_url';
    title: string;
    payload?: string;
    url?: string;
};

export function PersistentMenuForm({ shop }: PersistentMenuFormProps) {
    const [state, formAction] = useActionState(savePersistentMenu, initialState);
    const { toast } = useToast();
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

    useEffect(() => {
        setMenuItems(shop?.persistentMenu || []);
    }, [shop]);

    useEffect(() => {
        if (state.success) {
            toast({ title: 'Success!', description: 'Persistent menu updated successfully.' });
        }
        if (state.error) {
            toast({ title: 'Error Updating Menu', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);
    
    const handleItemChange = (index: number, field: keyof MenuItem, value: string) => {
        const newItems = [...menuItems];
        const item = {...newItems[index], [field]: value};
        
        // When type changes, clear the other value
        if (field === 'type') {
            if (value === 'web_url') delete item.payload;
            else delete item.url;
        }

        newItems[index] = item;
        setMenuItems(newItems);
    }

    const handleAddItem = () => {
        if (menuItems.length < 3) {
            setMenuItems(prev => [...prev, { type: 'postback', title: '' }]);
        }
    }

    const handleRemoveItem = (index: number) => {
        setMenuItems(prev => prev.filter((_, i) => i !== index));
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="shopId" value={shop._id.toString()} />
            <input type="hidden" name="menuItems" value={JSON.stringify(menuItems)} />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><List className="h-5 w-5"/>Persistent Menu</CardTitle>
                    <CardDescription>
                        Set up a static menu that's always available to users in your Messenger chat window. You can have up to 3 top-level items. Note: This menu is set at the Page level and will be overwritten by the last shop saved.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {menuItems.map((item, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleRemoveItem(index)}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                            <h4 className="font-medium">Menu Item {index + 1}</h4>
                            <div className="space-y-2">
                                <Label htmlFor={`title-${index}`}>Title</Label>
                                <Input id={`title-${index}`} value={item.title} onChange={e => handleItemChange(index, 'title', e.target.value)} maxLength={30} required/>
                            </div>
                            <RadioGroup value={item.type} onValueChange={(val) => handleItemChange(index, 'type', val)} className="flex gap-4">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="postback" id={`type-postback-${index}`} /><Label htmlFor={`type-postback-${index}`} className="font-normal">Trigger Flow</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="web_url" id={`type-url-${index}`} /><Label htmlFor={`type-url-${index}`} className="font-normal">Open Web URL</Label></div>
                            </RadioGroup>
                             {item.type === 'postback' ? (
                                <div className="space-y-2">
                                    <Label htmlFor={`payload-${index}`}>Payload (Trigger Keyword)</Label>
                                    <Input id={`payload-${index}`} value={item.payload || ''} onChange={e => handleItemChange(index, 'payload', e.target.value)} placeholder="e.g., MENU_BROWSE_PRODUCTS" required/>
                                    <p className="text-xs text-muted-foreground">This keyword will trigger the corresponding flow.</p>
                                </div>
                             ) : (
                                <div className="space-y-2">
                                    <Label htmlFor={`url-${index}`}>Website URL</Label>
                                    <Input id={`url-${index}`} type="url" value={item.url || ''} onChange={e => handleItemChange(index, 'url', e.target.value)} placeholder="https://example.com" required/>
                                </div>
                             )}
                        </div>
                    ))}
                    {menuItems.length < 3 && (
                        <Button type="button" variant="outline" className="w-full" onClick={handleAddItem}>
                            <Plus className="mr-2 h-4 w-4" /> Add Menu Item
                        </Button>
                    )}
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    )
}
