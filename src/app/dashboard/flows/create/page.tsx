
'use client';

import { Suspense, useActionState, useEffect, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, LoaderCircle, Save, FileJson, Plus, Trash2, Settings, AlertCircle, Server, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow, getMetaFlowById } from '@/app/actions/meta-flow.actions';
import { declarativeFlowComponents, type DeclarativeUIComponent } from '@/components/wabasimplify/meta-flow-templates';
import { MetaFlowPreview } from '@/components/wabasimplify/meta-flow-preview';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithId } from 'mongodb';
import type { MetaFlow } from '@/lib/definitions';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

const createFlowInitialState = { message: null, error: null, payload: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    const buttonText = isEditing ? 'Update Flow' : 'Save & Publish Flow';
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {buttonText}
        </Button>
    );
}

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-48"/>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Skeleton className="h-48 w-full"/>
                    <Skeleton className="h-96 w-full"/>
                </div>
                <Skeleton className="h-full w-full min-h-[720px] hidden lg:block"/>
            </div>
        </div>
    );
}

function ComponentEditorDialog({ component, onSave, onCancel, isOpen, onOpenChange }: { component: any, onSave: (newComponent: any) => void, onCancel: () => void, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const [localComponent, setLocalComponent] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (component) {
            setLocalComponent(JSON.parse(JSON.stringify(component)));
        }
    }, [component]);
    
    if (!localComponent) return null; 

    const updateField = (key: string, value: any) => {
        setLocalComponent((prev: any) => {
            if (value === undefined || value === '') {
                const newState = {...prev};
                delete newState[key];
                return newState;
            }
            return {...prev, [key]: value};
        });
    };

    const updateNestedField = (parentKey: string, childKey: string, value: any) => {
        setLocalComponent((prev: any) => {
            const newParent = {...(prev[parentKey] || {})};
            if (value === undefined || value === '') {
                delete newParent[childKey];
            } else {
                newParent[childKey] = value;
            }

            if(Object.keys(newParent).length === 0) {
                 const newState = {...prev};
                 delete newState[parentKey];
                 return newState;
            }

            return {...prev, [parentKey]: newParent};
        });
    };
    
    const handleDynamicBoolChange = (key: 'visible' | 'enabled', value: string) => {
        let finalValue: any = value;
        const lowerValue = value.toLowerCase().trim();

        if (lowerValue === 'true') {
            finalValue = true;
        } else if (lowerValue === 'false') {
            finalValue = false;
        } else if (value.trim() === '') {
            finalValue = undefined;
        }
        updateField(key, finalValue);
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                if (typeof index === 'number') { // Carousel image
                    const newImages = [...localComponent.images];
                    newImages[index].src = result;
                    updateField('images', newImages);
                } else { // Single image
                    updateField('src', result);
                }
                setIsUploading(false);
            };
            reader.onerror = () => {
                alert("Failed to read file");
                setIsUploading(false);
            }
            reader.readAsDataURL(file);
        }
    };
    
    const handleCarouselImageChange = (index: number, field: 'alt-text', value: string) => {
        const newImages = [...localComponent.images];
        newImages[index] = { ...newImages[index], [field]: value };
        updateField('images', newImages);
    };

    const addCarouselImage = () => {
        const images = localComponent.images || [];
        if (images.length < 3) {
            const newImages = [...images, { src: 'base64_image_placeholder', 'alt-text': '' }];
            updateField('images', newImages);
        }
    };

    const removeCarouselImage = (index: number) => {
        const newImages = localComponent.images.filter((_:any, i: number) => i !== index);
        updateField('images', newImages);
    };

    const handleDataSourceChange = (index: number, field: string, value: string | boolean) => {
        const newDataSource = [...(localComponent['data-source'] || [])];
        newDataSource[index] = { ...newDataSource[index], [field]: value };
        updateField('data-source', newDataSource);
    };
    
    const addDataSourceOption = () => {
        const newDataSource = [...(localComponent['data-source'] || []), { id: `opt_${Date.now()}`, title: 'New Option', enabled: true }];
        updateField('data-source', newDataSource);
    };
    
    const removeDataSourceOption = (index: number) => {
        const newDataSource = (localComponent['data-source'] || []).filter((_: any, i: number) => i !== index);
        updateField('data-source', newDataSource);
    };
    
    const handleActionChange = (actionName: string, field: 'name' | 'payload' | 'next' | 'url', value: any) => {
        const newAction = { ...(localComponent[actionName] || {}), [field]: value };
        if (field === 'name' && value !== 'navigate') {
            delete newAction.next;
        }
        if (field === 'name' && value !== 'open_url') {
            delete newAction.url;
        }
        updateField(actionName, newAction);
    };

    const handleInitValueChange = (value: string) => {
        const arrayValue = value.split(',').map(s => s.trim()).filter(Boolean);
        updateField('init-value', arrayValue.length > 0 ? arrayValue : undefined);
    };

    const handleUnavailableDatesChange = (value: string) => {
        const dates = value.split(',').map(s => s.trim()).filter(Boolean);
        updateField('unavailable-dates', dates.length > 0 ? dates : undefined);
    };

    const handleIncludeDaysChange = (day: string, checked: boolean) => {
        let currentDays: string[] = localComponent['include-days'] || [];
        if (checked) {
            currentDays = [...currentDays, day];
        } else {
            currentDays = currentDays.filter(d => d !== day);
        }
        updateField('include-days', currentDays.length > 0 ? currentDays : undefined);
    };

    const handleAllowedMimeTypesChange = (value: string) => {
        const types = value.split(',').map(s => s.trim()).filter(Boolean);
        updateField('allowed-mime-types', types.length > 0 ? types : undefined);
    };

    const handleListItemChange = (itemIndex: number, field: string, value: any, parentField?: string) => {
        const newItems = [...(localComponent['list-items'] || [])];
        if (parentField) {
            newItems[itemIndex] = {
                ...newItems[itemIndex],
                [parentField]: {
                    ...(newItems[itemIndex][parentField] || {}),
                    [field]: value
                }
            };
        } else {
            newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
        }
        updateField('list-items', newItems);
    };

    const handleListItemActionChange = (itemIndex: number, field: 'name' | 'payload' | 'next' | 'url', value: any) => {
        const newAction = { ...((localComponent['list-items'] || [])[itemIndex]['on-click-action'] || {}), [field]: value };
        handleListItemChange(itemIndex, 'on-click-action', newAction);
    };
    
    const addListItem = () => {
        const newItems = [...(localComponent['list-items'] || []), { id: `item_${Date.now()}`, "main-content": { title: "New Item" } }];
        updateField('list-items', newItems);
    };
    
    const removeListItem = (itemIndex: number) => {
        const newItems = (localComponent['list-items'] || []).filter((_: any, i: number) => i !== itemIndex);
        updateField('list-items', newItems);
    };

    const renderProperties = () => {
        const isTextComponent = ['TextHeading', 'TextSubheading', 'TextBody', 'TextCaption'].includes(localComponent?.type);
        const isImageComponent = localComponent?.type === 'Image';
        const isCarouselComponent = localComponent?.type === 'ImageCarousel';
        const isTextInputComponent = localComponent?.type === 'TextInput';
        const isTextAreaComponent = localComponent?.type === 'TextArea';
        const isSelectionComponent = ['Dropdown', 'RadioButtonsGroup', 'CheckboxGroup'].includes(localComponent?.type);
        const isChipsSelectorComponent = localComponent?.type === 'ChipsSelector';
        const isDatePickerComponent = localComponent?.type === 'DatePicker';
        const isCalendarPickerComponent = localComponent?.type === 'CalendarPicker';
        const isPhotoPickerComponent = localComponent?.type === 'PhotoPicker';
        const isDocumentPickerComponent = localComponent?.type === 'DocumentPicker';
        const isOptInComponent = localComponent?.type === 'OptIn';
        const isFooterComponent = localComponent?.type === 'Footer';
        const isEmbeddedLinkComponent = localComponent?.type === 'EmbeddedLink';
        const isNavigationListComponent = localComponent?.type === 'NavigationList';
        const isIfComponent = localComponent?.type === 'If';
        const isSwitchComponent = localComponent?.type === 'Switch';

        if (isIfComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="condition">Condition Expression</Label>
                        <Input id="condition" value={localComponent.condition || ''} onChange={(e) => updateField('condition', e.target.value)} placeholder="${form.age} > 18" required />
                    </div>
                     <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                           The 'then' and 'else' branches for this component must be edited in the Raw JSON view.
                        </AlertDescription>
                    </Alert>
                </div>
            )
        }
        
        if (isSwitchComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="value">Variable to Switch On</Label>
                        <Input id="value" value={localComponent.value || ''} onChange={(e) => updateField('value', e.target.value)} placeholder="${form.choice}" required />
                    </div>
                     <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                           The 'cases' for this component must be edited in the Raw JSON view.
                        </AlertDescription>
                    </Alert>
                </div>
            )
        }

        if (isNavigationListComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name (unique identifier)</Label>
                        <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="label">Label (optional, max 80 chars)</Label>
                        <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} maxLength={80} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (optional, max 300 chars)</Label>
                        <Textarea id="description" value={localComponent.description || ''} onChange={(e) => updateField('description', e.target.value)} maxLength={300} />
                    </div>
                    <div className="space-y-2">
                        <Label>List Items</Label>
                        <div className="space-y-3 p-2 border rounded-md max-h-72 overflow-y-auto">
                            {(localComponent['list-items'] || []).map((item: any, index: number) => (
                                <Accordion key={item.id} type="single" collapsible className="w-full bg-background rounded-md border">
                                    <AccordionItem value="item1" className="border-b-0">
                                        <AccordionTrigger className="p-3 text-sm">
                                            <span className="truncate flex-1 text-left">{item['main-content']?.title || `Item ${index + 1}`}</span>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeListItem(index); }}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-3 pt-0 space-y-4">
                                            <div className="space-y-2"><Label>ID</Label><Input value={item.id} onChange={(e) => handleListItemChange(index, 'id', e.target.value)} required/></div>
                                            <div className="p-2 border rounded-md space-y-2">
                                                <Label className="text-xs font-semibold">Main Content</Label>
                                                <Input placeholder="Title (max 30)" value={item['main-content']?.title || ''} onChange={(e) => handleListItemChange(index, 'title', e.target.value, 'main-content')} maxLength={30} />
                                                <Input placeholder="Description (max 20)" value={item['main-content']?.description || ''} onChange={(e) => handleListItemChange(index, 'description', e.target.value, 'main-content')} maxLength={20} />
                                                <Input placeholder="Metadata (max 80)" value={item['main-content']?.metadata || ''} onChange={(e) => handleListItemChange(index, 'metadata', e.target.value, 'main-content')} maxLength={80} />
                                            </div>
                                             <div className="p-2 border rounded-md space-y-2">
                                                <Label className="text-xs font-semibold">On-Click Action</Label>
                                                <Select value={item['on-click-action']?.name || ''} onValueChange={(val) => handleListItemActionChange(index, 'name', val)}>
                                                    <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="navigate">Navigate</SelectItem>
                                                        <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {item['on-click-action']?.name === 'navigate' && <Input placeholder="Next Screen ID" value={item['on-click-action']?.next?.name || ''} onChange={(e) => handleListItemActionChange(index, 'next', { type: 'screen', name: e.target.value })}/>}
                                                {item['on-click-action']?.name === 'data_exchange' && <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={item['on-click-action']?.payload ? JSON.stringify(item['on-click-action'].payload, null, 2) : ''} onChange={(e) => { try { handleListItemActionChange(index, 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>}/>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            ))}
                        </div>
                        <Button type="button" variant="outline" className="w-full" onClick={addListItem}><Plus className="mr-2 h-4 w-4"/>Add List Item</Button>
                    </div>
                </div>
            );
        }

        if (isEmbeddedLinkComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="text">Link Text (max 25 chars)</Label>
                        <Input id="text" value={localComponent.text || ''} onChange={(e) => updateField('text', e.target.value)} required maxLength={25} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="visible">Visible</Label>
                        <Input id="visible" value={localComponent.visible === undefined ? '' : String(localComponent.visible)} onChange={e => handleDynamicBoolChange('visible', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                    <div className="space-y-2">
                        <Label>On-Click Action (Required)</Label>
                        <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-click-action']?.name || ''} onValueChange={(val) => handleActionChange('on-click-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="navigate">Navigate</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                    <SelectItem value="open_url">Open URL</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-click-action']?.name === 'navigate' && (
                                 <Input placeholder="Next Screen ID" value={localComponent['on-click-action']?.next?.name || ''} onChange={(e) => handleActionChange('on-click-action', 'next', { type: 'screen', name: e.target.value })}/>
                            )}
                            {localComponent['on-click-action']?.name === 'open_url' && (
                                <Input placeholder="https://example.com" value={localComponent['on-click-action']?.url || ''} onChange={(e) => handleActionChange('on-click-action', 'url', e.target.value)}/>
                            )}
                            {(localComponent['on-click-action']?.name === 'data_exchange') && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-click-action']?.payload ? JSON.stringify(localComponent['on-click-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-click-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (isFooterComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="label">Button Label (max 35 chars)</Label>
                        <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} required maxLength={35} />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                         <Label>Captions (optional, max 15 chars each)</Label>
                         <p className="text-xs text-muted-foreground">You can use either a center caption OR left/right captions, but not all three.</p>
                         <Input placeholder="Left Caption" value={localComponent['left-caption'] || ''} onChange={e => updateField('left-caption', e.target.value)} maxLength={15} />
                         <Input placeholder="Center Caption" value={localComponent['center-caption'] || ''} onChange={e => updateField('center-caption', e.target.value)} maxLength={15} />
                         <Input placeholder="Right Caption" value={localComponent['right-caption'] || ''} onChange={e => updateField('right-caption', e.target.value)} maxLength={15} />
                    </div>
                    <Separator />
                     <div className="space-y-2">
                        <Label htmlFor="enabled">Enabled</Label>
                        <Input id="enabled" value={localComponent.enabled === undefined ? '' : String(localComponent.enabled)} onChange={e => handleDynamicBoolChange('enabled', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                    <div className="space-y-2">
                        <Label>On-Click Action (Required)</Label>
                        <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-click-action']?.name || ''} onValueChange={(val) => handleActionChange('on-click-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="complete">Complete Flow</SelectItem>
                                    <SelectItem value="navigate">Navigate</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-click-action']?.name === 'navigate' && (
                                 <Input placeholder="Next Screen ID" value={localComponent['on-click-action']?.next?.name || ''} onChange={(e) => handleActionChange('on-click-action', 'next', { type: 'screen', name: e.target.value })}/>
                            )}
                            {(localComponent['on-click-action']?.name === 'data_exchange' || localComponent['on-click-action']?.name === 'complete') && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-click-action']?.payload ? JSON.stringify(localComponent['on-click-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-click-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (isOptInComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name (unique identifier)</Label>
                        <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="label">Label</Label>
                        <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} required maxLength={120} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="required" checked={localComponent.required || false} onCheckedChange={(val) => updateField('required', val)} />
                            <Label htmlFor="required">Required</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="init-value" checked={localComponent['init-value'] || false} onCheckedChange={(val) => updateField('init-value', val)} />
                            <Label htmlFor="init-value">Initially Checked</Label>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="visible">Visible</Label>
                        <Input id="visible" value={localComponent.visible === undefined ? '' : String(localComponent.visible)} onChange={e => handleDynamicBoolChange('visible', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                    
                    <Separator />

                    <div className="space-y-2">
                        <Label>On-Click Action (for "Read more" link)</Label>
                        <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-click-action']?.name || ''} onValueChange={(val) => handleActionChange('on-click-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="No Action"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No Action</SelectItem>
                                    <SelectItem value="navigate">Navigate</SelectItem>
                                    <SelectItem value="open_url">Open URL</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-click-action']?.name === 'navigate' && (
                                 <Input placeholder="Next Screen ID" value={localComponent['on-click-action']?.next?.name || ''} onChange={(e) => handleActionChange('on-click-action', 'next', { type: 'screen', name: e.target.value })}/>
                            )}
                            {localComponent['on-click-action']?.name === 'open_url' && (
                                 <Input placeholder="https://example.com" value={localComponent['on-click-action']?.url || ''} onChange={(e) => handleActionChange('on-click-action', 'url', e.target.value)}/>
                            )}
                            {localComponent['on-click-action']?.name === 'data_exchange' && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-click-action'].payload ? JSON.stringify(localComponent['on-click-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-click-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>On-Select Action</Label>
                         <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-select-action']?.name || ''} onValueChange={(val) => handleActionChange('on-select-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="No Action"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No Action</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-select-action']?.name === 'data_exchange' && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-select-action'].payload ? JSON.stringify(localComponent['on-select-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-select-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>On-Unselect Action</Label>
                        <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-unselect-action']?.name || ''} onValueChange={(val) => handleActionChange('on-unselect-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="No Action"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No Action</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-unselect-action']?.name === 'data_exchange' && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-unselect-action'].payload ? JSON.stringify(localComponent['on-unselect-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-unselect-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (isDocumentPickerComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name (unique identifier)</Label>
                        <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="label">Label (Header Text, max 80 chars)</Label>
                        <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} required maxLength={80} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (optional, max 300 chars)</Label>
                        <Textarea id="description" value={localComponent.description || ''} onChange={(e) => updateField('description', e.target.value)} maxLength={300} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="min-uploaded-documents">Min Docs</Label>
                            <Input id="min-uploaded-documents" type="number" value={localComponent['min-uploaded-documents'] ?? ''} onChange={e => updateField('min-uploaded-documents', e.target.value ? parseInt(e.target.value) : undefined)} min="0" max="30" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max-uploaded-documents">Max Docs</Label>
                            <Input id="max-uploaded-documents" type="number" value={localComponent['max-uploaded-documents'] ?? ''} onChange={e => updateField('max-uploaded-documents', e.target.value ? parseInt(e.target.value) : undefined)} min="1" max="30" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="max-file-size-kb">Max File Size (KB)</Label>
                        <Input id="max-file-size-kb" type="number" value={localComponent['max-file-size-kb'] ?? ''} onChange={e => updateField('max-file-size-kb', e.target.value ? parseInt(e.target.value) : undefined)} max="25600" />
                        <p className="text-xs text-muted-foreground">Default is 25600KB (25MB).</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="allowed-mime-types">Allowed MIME Types (comma-separated)</Label>
                        <Textarea id="allowed-mime-types" value={(localComponent['allowed-mime-types'] || []).join(', ')} onChange={e => handleAllowedMimeTypesChange(e.target.value)} placeholder="application/pdf, image/jpeg" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="error-message">Error Message</Label>
                        <Input id="error-message" value={localComponent['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="enabled" checked={localComponent.enabled !== false} onCheckedChange={(val) => updateField('enabled', val)} />
                        <Label htmlFor="enabled">Enabled</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="visible" checked={localComponent.visible !== false} onCheckedChange={(val) => updateField('visible', val)} />
                        <Label htmlFor="visible">Visible</Label>
                    </div>
                    <div className="space-y-2">
                        <Label>On-Select Action (optional)</Label>
                        <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-select-action']?.name || ''} onValueChange={(val) => handleActionChange('on-select-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="No Action"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No Action</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-select-action']?.name === 'data_exchange' && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-select-action'].payload ? JSON.stringify(localComponent['on-select-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-select-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
        
        if (isPhotoPickerComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name (unique identifier)</Label>
                        <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="label">Label (Header Text, max 80 chars)</Label>
                        <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} required maxLength={80} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (optional, max 300 chars)</Label>
                        <Textarea id="description" value={localComponent.description || ''} onChange={(e) => updateField('description', e.target.value)} maxLength={300} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="photo-source">Photo Source</Label>
                        <Select value={localComponent['photo-source'] || 'camera_gallery'} onValueChange={(v) => updateField('photo-source', v)}>
                            <SelectTrigger id="photo-source"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="camera_gallery">Camera & Gallery</SelectItem>
                                <SelectItem value="camera">Camera Only</SelectItem>
                                <SelectItem value="gallery">Gallery Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="min-uploaded-photos">Min Photos</Label>
                            <Input id="min-uploaded-photos" type="number" value={localComponent['min-uploaded-photos'] ?? ''} onChange={e => updateField('min-uploaded-photos', e.target.value ? parseInt(e.target.value) : undefined)} min="0" max="30" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max-uploaded-photos">Max Photos</Label>
                            <Input id="max-uploaded-photos" type="number" value={localComponent['max-uploaded-photos'] ?? ''} onChange={e => updateField('max-uploaded-photos', e.target.value ? parseInt(e.target.value) : undefined)} min="1" max="30" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="max-file-size-kb">Max File Size (KB)</Label>
                        <Input id="max-file-size-kb" type="number" value={localComponent['max-file-size-kb'] ?? ''} onChange={e => updateField('max-file-size-kb', e.target.value ? parseInt(e.target.value) : undefined)} max="25600" />
                        <p className="text-xs text-muted-foreground">Default is 25600KB (25MB).</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="error-message">Error Message</Label>
                        <Input id="error-message" value={localComponent['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="enabled" checked={localComponent.enabled !== false} onCheckedChange={(val) => updateField('enabled', val)} />
                        <Label htmlFor="enabled">Enabled</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="visible" checked={localComponent.visible !== false} onCheckedChange={(val) => updateField('visible', val)} />
                        <Label htmlFor="visible">Visible</Label>
                    </div>
                    <div className="space-y-2">
                        <Label>On-Select Action (optional)</Label>
                        <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-select-action']?.name || ''} onValueChange={(val) => handleActionChange('on-select-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="No Action"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No Action</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-select-action']?.name === 'data_exchange' && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-select-action'].payload ? JSON.stringify(localComponent['on-select-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-select-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>
                </div>
            );
        }
        
        if (isCalendarPickerComponent) {
            const mode = localComponent.mode || 'single';
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name (unique identifier)</Label>
                        <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                    </div>
                     <div className="space-y-2">
                        <Label>Mode</Label>
                        <RadioGroup value={mode} onValueChange={(v) => updateField('mode', v)} className="flex gap-4 pt-1">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="single" id="mode-single"/><Label htmlFor="mode-single" className="font-normal">Single Date</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="range" id="mode-range"/><Label htmlFor="mode-range" className="font-normal">Date Range</Label></div>
                        </RadioGroup>
                    </div>

                    {mode === 'range' && (
                        <>
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" value={localComponent.title || ''} onChange={e => updateField('title', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={localComponent.description || ''} onChange={e => updateField('description', e.target.value)} />
                        </div>
                        </>
                    )}
                    
                     <div className="space-y-2">
                        <Label>Label(s)</Label>
                        {mode === 'single' ? (
                            <Input value={typeof localComponent.label === 'string' ? localComponent.label : ''} onChange={e => updateField('label', e.target.value)} required />
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <Input placeholder="Start Date Label" value={localComponent.label?.['start-date'] || ''} onChange={e => updateNestedField('label', 'start-date', e.target.value)} />
                                <Input placeholder="End Date Label" value={localComponent.label?.['end-date'] || ''} onChange={e => updateNestedField('label', 'end-date', e.target.value)} />
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label htmlFor="min-date">Min Date</Label><Input id="min-date" type="date" value={localComponent['min-date'] || ''} onChange={e => updateField('min-date', e.target.value)}/></div>
                        <div className="space-y-2"><Label htmlFor="max-date">Max Date</Label><Input id="max-date" type="date" value={localComponent['max-date'] || ''} onChange={e => updateField('max-date', e.target.value)}/></div>
                    </div>
                    <div className="space-y-2"><Label>Days of Week Included</Label><div className="flex flex-wrap gap-x-4 gap-y-2">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day} className="flex items-center space-x-2"><Checkbox id={`day-${day}`} checked={(localComponent['include-days'] || []).includes(day)} onCheckedChange={checked => handleIncludeDaysChange(day, !!checked)}/><Label htmlFor={`day-${day}`} className="font-normal">{day}</Label></div>)}</div></div>

                     {mode === 'range' && (
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2"><Label htmlFor="min-days">Min Days in Range</Label><Input id="min-days" type="number" value={localComponent['min-days'] ?? ''} onChange={e => updateField('min-days', e.target.value ? parseInt(e.target.value) : undefined)}/></div>
                           <div className="space-y-2"><Label htmlFor="max-days">Max Days in Range</Label><Input id="max-days" type="number" value={localComponent['max-days'] ?? ''} onChange={e => updateField('max-days', e.target.value ? parseInt(e.target.value) : undefined)}/></div>
                        </div>
                     )}

                </div>
            )
        }

        if (isDatePickerComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name (unique identifier)</Label>
                        <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="label">Label (shown to user)</Label>
                        <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="helper-text">Helper Text</Label>
                        <Input id="helper-text" value={localComponent['helper-text'] || ''} onChange={(e) => updateField('helper-text', e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="error-message">Error Message</Label>
                        <Input id="error-message" value={localComponent['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="min-date">Min Date</Label>
                            <Input id="min-date" type="date" value={localComponent['min-date'] || ''} onChange={e => updateField('min-date', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="max-date">Max Date</Label>
                            <Input id="max-date" type="date" value={localComponent['max-date'] || ''} onChange={e => updateField('max-date', e.target.value)} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="init-value">Initial Value (Date)</Label>
                        <Input id="init-value" type="date" value={localComponent['init-value'] || ''} onChange={e => updateField('init-value', e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="unavailable-dates">Unavailable Dates (comma-separated)</Label>
                        <Textarea id="unavailable-dates" value={(localComponent['unavailable-dates'] || []).join(', ')} onChange={e => handleUnavailableDatesChange(e.target.value)} placeholder="2024-12-25, 2025-01-01" />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="required" checked={localComponent.required || false} onCheckedChange={(val) => updateField('required', val)} />
                        <Label htmlFor="required">Required</Label>
                    </div>
                     <div className="space-y-2">
                        <Label>On-Select Action (optional)</Label>
                        <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-select-action']?.name || ''} onValueChange={(val) => handleActionChange('on-select-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="No Action"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No Action</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-select-action']?.name === 'data_exchange' && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-select-action'].payload ? JSON.stringify(localComponent['on-select-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-select-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="visible">Visible</Label>
                        <Input id="visible" value={localComponent.visible === undefined ? '' : String(localComponent.visible)} onChange={e => handleDynamicBoolChange('visible', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="enabled">Enabled</Label>
                        <Input id="enabled" value={localComponent.enabled === undefined ? '' : String(localComponent.enabled)} onChange={e => handleDynamicBoolChange('enabled', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                </div>
            );
        }

        if (isChipsSelectorComponent) {
             return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name (unique identifier)</Label>
                            <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="label">Label (shown to user)</Label>
                            <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="description">Description (optional)</Label>
                        <Textarea id="description" value={localComponent.description || ''} onChange={(e) => updateField('description', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Data Source (Chips)</Label>
                        <div className="space-y-3 max-h-48 overflow-y-auto border p-2 rounded-md bg-background">
                            {(localComponent['data-source'] || []).map((opt: any, index: number) => (
                                <div key={opt.id} className="p-3 border rounded-lg bg-muted/50 relative">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeDataSourceOption(index)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input placeholder="ID (e.g., music)" value={opt.id} onChange={(e) => handleDataSourceChange(index, 'id', e.target.value)} />
                                        <Input placeholder="Title (e.g., Music)" value={opt.title} onChange={(e) => handleDataSourceChange(index, 'title', e.target.value)} />
                                    </div>
                                    <div className="flex items-center space-x-2 mt-2"><Switch checked={opt.enabled !== false} onCheckedChange={(val) => handleDataSourceChange(index, 'enabled', val)} /><Label>Enabled</Label></div>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addDataSourceOption} className="w-full"><Plus className="mr-2 h-4 w-4"/>Add Chip</Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="min-selected-items">Min Selected</Label>
                            <Input id="min-selected-items" type="number" value={localComponent['min-selected-items'] ?? ''} onChange={e => updateField('min-selected-items', e.target.value ? parseInt(e.target.value) : undefined)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max-selected-items">Max Selected</Label>
                            <Input id="max-selected-items" type="number" value={localComponent['max-selected-items'] ?? ''} onChange={e => updateField('max-selected-items', e.target.value ? parseInt(e.target.value) : undefined)} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="init-value">Initial Values (optional)</Label>
                        <Input id="init-value" value={Array.isArray(localComponent['init-value']) ? localComponent['init-value'].join(', ') : ''} onChange={e => handleInitValueChange(e.target.value)} placeholder="Comma-separated IDs" />
                    </div>

                     <div className="space-y-2">
                        <Label htmlFor="error-message">Error Message</Label>
                        <Input id="error-message" value={localComponent['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="required" checked={localComponent.required || false} onCheckedChange={(val) => updateField('required', val)} />
                        <Label htmlFor="required">Required</Label>
                    </div>
                </div>
             )
        }

        if (isSelectionComponent) {
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name (unique identifier)</Label>
                            <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="label">Label (shown to user)</Label>
                            <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Data Source (Options)</Label>
                        <div className="space-y-3 max-h-48 overflow-y-auto border p-2 rounded-md bg-background">
                            {(localComponent['data-source'] || []).map((opt: any, index: number) => (
                                <div key={opt.id} className="p-3 border rounded-lg bg-muted/50 relative">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeDataSourceOption(index)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input placeholder="ID (e.g., us)" value={opt.id} onChange={(e) => handleDataSourceChange(index, 'id', e.target.value)} />
                                        <Input placeholder="Title (e.g., USA)" value={opt.title} onChange={(e) => handleDataSourceChange(index, 'title', e.target.value)} />
                                        <Textarea className="col-span-2" placeholder="Description (optional)" value={opt.description || ''} onChange={(e) => handleDataSourceChange(index, 'description', e.target.value)} />
                                        {localComponent.type === 'Dropdown' && <Input className="col-span-2" placeholder="Metadata (optional, e.g. icon)" value={opt.metadata || ''} onChange={(e) => handleDataSourceChange(index, 'metadata', e.target.value)} />}
                                    </div>
                                    <div className="flex items-center space-x-2 mt-2"><Switch checked={opt.enabled !== false} onCheckedChange={(val) => handleDataSourceChange(index, 'enabled', val)} /><Label>Enabled</Label></div>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addDataSourceOption} className="w-full"><Plus className="mr-2 h-4 w-4"/>Add Option</Button>
                    </div>

                    {localComponent.type === 'CheckboxGroup' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="min-selected-items">Min Selected</Label>
                                <Input id="min-selected-items" type="number" value={localComponent['min-selected-items'] ?? ''} onChange={e => updateField('min-selected-items', e.target.value ? parseInt(e.target.value) : undefined)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="max-selected-items">Max Selected</Label>
                                <Input id="max-selected-items" type="number" value={localComponent['max-selected-items'] ?? ''} onChange={e => updateField('max-selected-items', e.target.value ? parseInt(e.target.value) : undefined)} />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>On-Select Action (optional)</Label>
                        <div className="p-3 border rounded-lg space-y-3">
                            <Select value={localComponent['on-select-action']?.name || ''} onValueChange={(val) => handleActionChange('on-select-action', 'name', val)}>
                                <SelectTrigger><SelectValue placeholder="No Action"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">No Action</SelectItem>
                                    <SelectItem value="data_exchange">Data Exchange</SelectItem>
                                    <SelectItem value="navigate">Navigate</SelectItem>
                                </SelectContent>
                            </Select>
                            {localComponent['on-select-action']?.name === 'data_exchange' && (
                                <Textarea placeholder='Payload (JSON)' className="font-mono text-xs" value={localComponent['on-select-action'].payload ? JSON.stringify(localComponent['on-select-action'].payload, null, 2) : ''} onChange={(e) => { try { handleActionChange('on-select-action', 'payload', e.target.value ? JSON.parse(e.target.value) : undefined) } catch {} }}/>
                            )}
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="error-message">Error Message</Label>
                        <Input id="error-message" value={localComponent['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="required" checked={localComponent.required || false} onCheckedChange={(val) => updateField('required', val)} />
                        <Label htmlFor="required">Required</Label>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="visible">Visible</Label>
                        <Input id="visible" value={localComponent.visible === undefined ? '' : String(localComponent.visible)} onChange={e => handleDynamicBoolChange('visible', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="enabled">Enabled</Label>
                        <Input id="enabled" value={localComponent.enabled === undefined ? '' : String(localComponent.enabled)} onChange={e => handleDynamicBoolChange('enabled', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                     {localComponent.type === 'Dropdown' && (
                        <div className="space-y-2">
                            <Label htmlFor="init-value">Initial Value (optional)</Label>
                            <Input id="init-value" value={localComponent['init-value'] || ''} onChange={(e) => updateField('init-value', e.target.value)} placeholder="ID of a default option" />
                        </div>
                     )}
                     {localComponent.type === 'CheckboxGroup' && (
                        <div className="space-y-2">
                            <Label htmlFor="init-value">Initial Values (optional)</Label>
                            <Input id="init-value" value={Array.isArray(localComponent['init-value']) ? localComponent['init-value'].join(', ') : ''} onChange={e => handleInitValueChange(e.target.value)} placeholder="Comma-separated IDs" />
                        </div>
                     )}
                     {localComponent.type === 'RadioButtonsGroup' && (
                        <div className="space-y-2">
                            <Label htmlFor="init-value">Initial Value (optional)</Label>
                            <Input id="init-value" value={localComponent['init-value'] || ''} onChange={(e) => updateField('init-value', e.target.value)} placeholder="ID of a default option" />
                        </div>
                     )}
                </div>
            )
        }

        if (isImageComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="image-upload">Upload Image</Label>
                        <Input id="image-upload" type="file" accept="image/png, image/jpeg" onChange={handleImageUpload} />
                        {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                        {localComponent.src && localComponent.src.startsWith('data:image') && (
                            <Image src={localComponent.src} alt="preview" width={200} height={112} className="mt-2 max-h-40 w-auto rounded-md border" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="alt-text">Alt Text (Required)</Label>
                        <Input id="alt-text" value={localComponent['alt-text'] || ''} onChange={e => updateField('alt-text', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="width">Width (optional)</Label>
                            <Input id="width" type="number" value={localComponent.width || ''} onChange={e => updateField('width', e.target.value ? parseInt(e.target.value) : undefined)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="height">Height (optional)</Label>
                            <Input id="height" type="number" value={localComponent.height || ''} onChange={e => updateField('height', e.target.value ? parseInt(e.target.value) : undefined)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
                            <Select
                                value={String(localComponent['aspect-ratio'] || '')}
                                onValueChange={v => updateField('aspect-ratio', v ? parseFloat(v) : undefined)}
                            >
                                <SelectTrigger id="aspect-ratio"><SelectValue placeholder="Default"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Default</SelectItem>
                                    <SelectItem value="1.777">16:9 (Widescreen)</SelectItem>
                                    <SelectItem value="1.333">4:3 (Standard)</SelectItem>
                                    <SelectItem value="1">1:1 (Square)</SelectItem>
                                    <SelectItem value="1.5">3:2</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="scale-type">Scale Type</Label>
                            <Select value={localComponent['scale-type'] || 'contain'} onValueChange={v => updateField('scale-type', v)}>
                                <SelectTrigger id="scale-type"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="contain">Contain</SelectItem>
                                    <SelectItem value="cover">Cover</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            );
        }

        if (isCarouselComponent) {
             return (
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="carousel-aspect-ratio">Aspect Ratio</Label>
                            <Select value={localComponent['aspect-ratio'] || '16:9'} onValueChange={v => updateField('aspect-ratio', v)}>
                                <SelectTrigger id="carousel-aspect-ratio"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                                    <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="carousel-scale-type">Scale Type</Label>
                            <Select value={localComponent['scale-type'] || 'contain'} onValueChange={v => updateField('scale-type', v)}>
                                <SelectTrigger id="carousel-scale-type"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="contain">Contain</SelectItem>
                                    <SelectItem value="cover">Cover</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Separator />
                     <div className="space-y-3">
                        <Label>Images (Max 3)</Label>
                        {(localComponent.images || []).map((img: any, index: number) => (
                            <div key={index} className="p-3 border rounded-lg space-y-2 relative bg-background">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeCarouselImage(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                                <div className="space-y-2">
                                    <Label htmlFor={`carousel-img-upload-${index}`}>Upload Image {index + 1}</Label>
                                    <Input id={`carousel-img-upload-${index}`} type="file" accept="image/png, image/jpeg" onChange={e => handleImageUpload(e, index)} />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor={`carousel-alt-text-${index}`}>Alt Text {index + 1}</Label>
                                    <Input id={`carousel-alt-text-${index}`} value={img['alt-text'] || ''} onChange={e => handleCarouselImageChange(index, 'alt-text', e.target.value)} />
                                </div>
                                 {img.src && img.src.startsWith('data:image') && (
                                    <Image src={img.src} alt="preview" width={150} height={84} className="mt-2 rounded-md border" />
                                )}
                            </div>
                        ))}
                        {(localComponent.images?.length || 0) < 3 && (
                            <Button type="button" variant="outline" className="w-full" onClick={addCarouselImage}>
                                <Plus className="mr-2 h-4 w-4" /> Add Image
                            </Button>
                        )}
                    </div>
                </div>
            );
        }

        if (isTextComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="text">Text</Label>
                        <Textarea id="text" value={localComponent.text || ''} onChange={e => updateField('text', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="visible">Visible (optional)</Label>
                        <Input 
                            id="visible" 
                            value={localComponent.visible === undefined ? '' : String(localComponent.visible)} 
                            onChange={e => handleDynamicBoolChange('visible', e.target.value)} 
                            placeholder="true, false, or ${...}" 
                        />
                        <p className="text-xs text-muted-foreground">Enter `true`, `false`, or a dynamic expression like `${'{form.show_field}'}`.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="enabled">Enabled (optional)</Label>
                        <Input 
                            id="enabled" 
                            value={localComponent.enabled === undefined ? '' : String(localComponent.enabled)} 
                            onChange={e => handleDynamicBoolChange('enabled', e.target.value)} 
                            placeholder="true, false, or ${...}" 
                        />
                    </div>
                </div>
            );
        }
        
        if (isTextInputComponent || isTextAreaComponent) {
            return (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name (unique identifier)</Label>
                        <Input id="name" value={localComponent.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="label">Label (shown to user)</Label>
                        <Input id="label" value={localComponent.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="placeholder">Placeholder</Label>
                        <Input id="placeholder" value={localComponent.placeholder || ''} onChange={(e) => updateField('placeholder', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="helper-text">Helper Text</Label>
                        <Input id="helper-text" value={localComponent['helper-text'] || ''} onChange={(e) => updateField('helper-text', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="error-message">Error Message</Label>
                        <Input id="error-message" value={localComponent['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
                    </div>
                    {isTextInputComponent && (
                        <div className="space-y-2">
                            <Label htmlFor="input-type">Input Type</Label>
                            <Select value={localComponent['input-type'] || 'text'} onValueChange={(v) => updateField('input-type', v)}>
                                <SelectTrigger id="input-type"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="text">Text</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="password">Password</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="min-length">Min Length</Label>
                            <Input id="min-length" type="number" value={localComponent['min-length'] ?? ''} onChange={e => updateField('min-length', e.target.value ? parseInt(e.target.value) : undefined)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max-length">Max Length</Label>
                            <Input id="max-length" type="number" value={localComponent['max-length'] ?? ''} onChange={e => updateField('max-length', e.target.value ? parseInt(e.target.value) : undefined)} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="required" checked={localComponent.required || false} onCheckedChange={(val) => updateField('required', val)} />
                        <Label htmlFor="required">Required</Label>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="init-value">Initial Value (optional)</Label>
                        <Input id="init-value" value={localComponent['init-value'] || ''} onChange={(e) => updateField('init-value', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="visible">Visible</Label>
                        <Input id="visible" value={localComponent.visible === undefined ? '' : String(localComponent.visible)} onChange={e => handleDynamicBoolChange('visible', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="enabled">Enabled</Label>
                        <Input id="enabled" value={localComponent.enabled === undefined ? '' : String(localComponent.enabled)} onChange={e => handleDynamicBoolChange('enabled', e.target.value)} placeholder="true, false, or ${...}" />
                    </div>
                </div>
            );
        }

        // Generic fallback for other components
        return (
             <div className="space-y-2">
                <Label htmlFor="generic-json">Component JSON</Label>
                <Textarea 
                    id="generic-json" 
                    value={JSON.stringify(localComponent, null, 2)} 
                    onChange={e => { try { setLocalComponent(JSON.parse(e.target.value)) } catch(err) { /* ignore parse error on type */}}} 
                    className="font-mono text-xs h-64"
                />
                 <p className="text-xs text-muted-foreground">Advanced: Edit the raw JSON for this component.</p>
            </div>
        );
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit Component: {localComponent.type}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="py-4 space-y-4">
                    {renderProperties()}
                </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={() => onSave(localComponent)}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CreateMetaFlowPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);

    const [projectId, setProjectId] = useState<string | null>(null);
    const [flowName, setFlowName] = useState('New Interactive Flow');
    const [category, setCategory] = useState('');
    const [publishOnSave, setPublishOnSave] = useState(true);
    const [flowData, setFlowData] = useState<any>({ screens: [], routing_model: {} });
    const [flowId, setFlowId] = useState<string | null>(null);
    const [metaId, setMetaId] = useState<string | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();

    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
    const [editingComponent, setEditingComponent] = useState<any>(null);
    const [isComponentEditorOpen, setIsComponentEditorOpen] = useState(false);

    const isEditing = !!flowId;

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);

        const flowIdParam = searchParams.get('flowId');
        if (flowIdParam) {
            setFlowId(flowIdParam);
            startLoadingTransition(async () => {
                const fetchedFlow = await getMetaFlowById(flowIdParam);
                if (fetchedFlow) {
                    setFlowName(fetchedFlow.name);
                    setCategory(fetchedFlow.categories?.[0] || '');
                    setFlowData(fetchedFlow.flow_data || { screens: [], routing_model: {} });
                    setMetaId(fetchedFlow.metaId);
                    if (fetchedFlow.flow_data?.screens?.[0]) {
                        setSelectedScreenId(fetchedFlow.flow_data.screens[0].id);
                    }
                } else {
                    toast({ title: 'Error', description: 'Could not load the requested flow.', variant: 'destructive' });
                    router.push('/dashboard/flows');
                }
            });
        }
    }, [searchParams, router, toast]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/flows');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);
    
    //... (other functions remain the same)

    const updateComponent = (updatedComponent: any) => {
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s:any) => s.id === selectedScreenId);
        if (screen) {
            const container = screen.layout.children.find((c:any) => c.type === 'Form' || c.type === 'NavigationList');
            if (container) {
                const componentIndex = container.children?.findIndex((c:any) => c.name === updatedComponent.name) ?? -1;
                if (componentIndex > -1) {
                    container.children[componentIndex] = updatedComponent;
                }
            }
        }
        setFlowData(newFlowData);
        closeComponentEditor();
    };

    const addScreen = () => {
        const newScreenId = `SCREEN_${flowData.screens.length + 1}_${Date.now()}`.slice(0, 50);
        const newScreen = {
            id: newScreenId,
            title: 'New Screen',
            layout: {
                type: 'SingleColumnLayout',
                children: [
                    { type: 'Form', name: `${newScreenId}_FORM`, children: [] }
                ]
            }
        };
        const newFlowData = { ...flowData };
        newFlowData.screens = [...newFlowData.screens, newScreen];
        if (!newFlowData.routing_model[newScreenId]) {
            newFlowData.routing_model[newScreenId] = [];
        }
        setFlowData(newFlowData);
        setSelectedScreenId(newScreenId);
    };
    
    const removeScreen = (screenId: string) => {
        const newFlowData = { ...flowData };
        newFlowData.screens = newFlowData.screens.filter((s:any) => s.id !== screenId);
        delete newFlowData.routing_model[screenId];
        Object.keys(newFlowData.routing_model).forEach(key => {
            newFlowData.routing_model[key] = newFlowData.routing_model[key].filter((id:string) => id !== screenId);
        });
        setFlowData(newFlowData);
        if (selectedScreenId === screenId) {
            setSelectedScreenId(newFlowData.screens[0]?.id || null);
        }
    };
    
    const addComponent = (type: DeclarativeUIComponent['type']) => {
        if (!selectedScreenId) return;
        const newComponent: any = { type, name: `${type.toLowerCase()}_${Date.now()}` };
        // Set defaults based on type
        if (type.startsWith('Text')) newComponent.text = `New ${type}`;
        else newComponent.label = `New ${type}`;
        
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s:any) => s.id === selectedScreenId);
        if (screen) {
            let container = screen.layout.children.find((c:any) => c.type === 'Form');
            if (!container) {
                container = { type: 'Form', name: `${selectedScreenId}_FORM`, children: [] };
                screen.layout.children.push(container);
            }
            container.children.push(newComponent);
            setFlowData(newFlowData);
        }
    };

    const removeComponent = (componentName: string) => {
        if (!selectedScreenId) return;
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s:any) => s.id === selectedScreenId);
        if (screen) {
            const container = screen.layout.children.find((c:any) => c.type === 'Form' || c.type === 'NavigationList');
            if (container) {
                container.children = container.children.filter((c:any) => c.name !== componentName);
                setFlowData(newFlowData);
            }
        }
    };

    const openComponentEditor = (component: any) => {
        setEditingComponent(component);
        setIsComponentEditorOpen(true);
    };
    
    const closeComponentEditor = () => {
        setEditingComponent(null);
        setIsComponentEditorOpen(false);
    };

    if (isLoading) {
        return <PageSkeleton />;
    }

    const currentScreenForEditor = flowData.screens?.find((s: any) => s.id === selectedScreenId);
    
    return (
        <Suspense fallback={<PageSkeleton />}>
            {editingComponent && <ComponentEditorDialog component={editingComponent} onSave={updateComponent} onCancel={closeComponentEditor} isOpen={isComponentEditorOpen} onOpenChange={setIsComponentEditorOpen} />}

            <form action={formAction}>
                 {projectId && <input type="hidden" name="projectId" value={projectId} />}
                {flowId && <input type="hidden" name="flowId" value={flowId} />}
                {metaId && <input type="hidden" name="metaId" value={metaId} />}
                <input type="hidden" name="flow_data" value={JSON.stringify(flowData, null, 2)} />
                <input type="hidden" name="publish" value={publishOnSave ? 'on' : 'off'} />

                <div className="space-y-6">
                    <div>
                        <Button variant="ghost" asChild className="mb-2 -ml-4">
                            <Link href="/dashboard/flows"><ChevronLeft className="mr-2 h-4 w-4" />Back to Flows</Link>
                        </Button>
                        <h1 className="text-3xl font-bold font-headline">{isEditing ? 'Edit Meta Flow' : 'Create New Meta Flow'}</h1>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Flow Configuration</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="flowName">Flow Name</Label>
                                        <Input id="flowName" name="flowName" value={flowName} onChange={(e) => setFlowName(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Category</Label>
                                        <Select name="category" value={category} onValueChange={setCategory} required>
                                            <SelectTrigger id="category"><SelectValue placeholder="Select a category..."/></SelectTrigger>
                                            <SelectContent>{declarativeFlowComponents.map(cat => <SelectItem key={cat.type} value={cat.type}>{cat.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Switch id="publishOnSave" checked={publishOnSave} onCheckedChange={setPublishOnSave} />
                                        <Label htmlFor="publishOnSave">Publish immediately after saving</Label>
                                    </div>
                                </CardContent>
                            </Card>

                            <Accordion type="single" collapsible defaultValue="screens">
                                <AccordionItem value="screens">
                                    <AccordionTrigger className="text-base font-semibold">Screens</AccordionTrigger>
                                    <AccordionContent className="space-y-2">
                                        {flowData.screens?.map((screen: any) => (
                                             <div key={screen.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                                                <Button variant={selectedScreenId === screen.id ? 'default' : 'ghost'} className="flex-1 justify-start" onClick={() => setSelectedScreenId(screen.id)}>{screen.title || screen.id}</Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeScreen(screen.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" className="w-full" onClick={addScreen}><Plus className="mr-2 h-4 w-4"/>Add Screen</Button>
                                    </AccordionContent>
                                </AccordionItem>
                                 <AccordionItem value="settings">
                                    <AccordionTrigger className="text-base font-semibold">Screen Settings</AccordionTrigger>
                                    <AccordionContent className="space-y-4">
                                       {currentScreenForEditor ? (
                                        <>
                                            <div className="space-y-2"><Label>Screen ID</Label><Input value={currentScreenForEditor.id} readOnly disabled/></div>
                                            <div className="space-y-2"><Label>Screen Title</Label><Input value={currentScreenForEditor.title} onChange={e => {
                                                const newFlowData = {...flowData};
                                                const screen = newFlowData.screens.find((s:any) => s.id === selectedScreenId);
                                                if(screen) screen.title = e.target.value;
                                                setFlowData(newFlowData);
                                            }}/></div>
                                        </>
                                       ) : <p className="text-sm text-muted-foreground">Select a screen to see its settings.</p>}
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="components">
                                     <AccordionTrigger className="text-base font-semibold">Components</AccordionTrigger>
                                     <AccordionContent className="space-y-2">
                                        {currentScreenForEditor ? (
                                            <>
                                                {(currentScreenForEditor.layout.children.find((c:any) => c.type === 'Form')?.children || []).map((comp:any, index:number) => (
                                                     <div key={comp.name || index} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                                                         <p className="flex-1 text-sm">{comp.label || comp.text || comp.name || comp.type}</p>
                                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openComponentEditor(comp)}><Settings className="h-4 w-4"/></Button>
                                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeComponent(comp.name)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                     </div>
                                                ))}
                                                <Popover>
                                                    <PopoverTrigger asChild><Button variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4"/>Add Component</Button></PopoverTrigger>
                                                    <PopoverContent className="w-56 p-2">
                                                        <ScrollArea className="h-72">
                                                            {declarativeFlowComponents.map(c => <Button key={c.type} variant="ghost" className="w-full justify-start" onClick={() => addComponent(c.type)}>{c.label}</Button>)}
                                                        </ScrollArea>
                                                    </PopoverContent>
                                                </Popover>
                                            </>
                                        ): <p className="text-sm text-muted-foreground">Select a screen to add components.</p>}
                                     </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="json">
                                    <AccordionTrigger className="text-base font-semibold">Raw JSON</AccordionTrigger>
                                    <AccordionContent><Textarea value={JSON.stringify(flowData, null, 2)} onChange={(e) => { try { const parsed = JSON.parse(e.target.value); setFlowData(parsed); } catch(err) {/* ignore */} }} className="h-96 font-mono text-xs" /></AccordionContent>
                                </AccordionItem>
                            </Accordion>

                             <div className="flex justify-end pt-4">
                                <SubmitButton isEditing={isEditing} />
                            </div>
                        </div>

                        <div className="hidden lg:block">
                            <MetaFlowPreview flowJson={JSON.stringify(flowData)} />
                        </div>
                    </div>
                </div>
            </form>
        </Suspense>
    );
}

export default function CreateMetaFlowPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <CreateMetaFlowPageContent />
        </Suspense>
    );
}
