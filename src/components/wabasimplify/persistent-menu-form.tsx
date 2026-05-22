'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  Separator,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus, Save, Trash2, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { savePersistentMenu } from '@/app/actions/facebook.actions';
import type { WithId,
  EcommShop } from '@/lib/definitions';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Menu
    </ZoruButton>
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

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2"><List className="h-5 w-5"/>Persistent Menu</ZoruCardTitle>
                    <ZoruCardDescription>
                        Set up a static menu that's always available to users in your Messenger chat window. You can have up to 3 top-level items. Note: This menu is set at the Page level and will be overwritten by the last shop saved.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    {menuItems.map((item, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-3 relative">
                            <ZoruButton variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleRemoveItem(index)}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </ZoruButton>
                            <h4 className="font-medium">Menu Item {index + 1}</h4>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor={`title-${index}`}>Title</ZoruLabel>
                                <ZoruInput id={`title-${index}`} value={item.title} onChange={e => handleItemChange(index, 'title', e.target.value)} maxLength={30} required/>
                            </div>
                            <ZoruRadioGroup value={item.type} onValueChange={(val) => handleItemChange(index, 'type', val)} className="flex gap-4">
                                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="postback" id={`type-postback-${index}`} /><ZoruLabel htmlFor={`type-postback-${index}`} className="font-normal">Trigger Flow</ZoruLabel></div>
                                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="web_url" id={`type-url-${index}`} /><ZoruLabel htmlFor={`type-url-${index}`} className="font-normal">Open Web URL</ZoruLabel></div>
                            </ZoruRadioGroup>
                             {item.type === 'postback' ? (
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor={`payload-${index}`}>Payload (Trigger Keyword)</ZoruLabel>
                                    <ZoruInput id={`payload-${index}`} value={item.payload || ''} onChange={e => handleItemChange(index, 'payload', e.target.value)} placeholder="e.g., MENU_BROWSE_PRODUCTS" required/>
                                    <p className="text-xs text-muted-foreground">This keyword will trigger the corresponding flow.</p>
                                </div>
                             ) : (
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor={`url-${index}`}>Website URL</ZoruLabel>
                                    <ZoruInput id={`url-${index}`} type="url" value={item.url || ''} onChange={e => handleItemChange(index, 'url', e.target.value)} placeholder="https://example.com" required/>
                                </div>
                             )}
                        </div>
                    ))}
                    {menuItems.length < 3 && (
                        <ZoruButton type="button" variant="outline" className="w-full" onClick={handleAddItem}>
                            <Plus className="mr-2 h-4 w-4" /> Add Menu Item
                        </ZoruButton>
                    )}
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </ZoruCard>
        </form>
    )
}
