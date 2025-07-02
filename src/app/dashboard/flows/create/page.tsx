
'use client';

import { Suspense, useActionState, useEffect, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, LoaderCircle, Save, FileJson, Plus, Trash2, Settings, AlertCircle, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow, getMetaFlowById } from '@/app/actions/meta-flow.actions';
import { flowCategories, declarativeFlowComponents, type DeclarativeUIComponent } from '@/components/wabasimplify/meta-flow-templates';
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
    const [localComponent, setLocalComponent] = useState(component);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if(component) {
            setLocalComponent(component);
        }
    }, [component]);
    
    if (!component || !localComponent) return null; 

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

    const renderProperties = () => {
        const isTextComponent = ['TextHeading', 'TextSubheading', 'TextBody', 'TextCaption'].includes(component?.type);
        const isImageComponent = component?.type === 'Image';
        const isCarouselComponent = component?.type === 'ImageCarousel';
        const isTextInputComponent = component?.type === 'TextInput';

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
                            <Label htmlFor="aspect-ratio">Aspect Ratio (optional)</Label>
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
                            <Label htmlFor="scale-type">Scale Type (optional)</Label>
                            <Select value={localComponent['scale-type'] || 'contain'} onValueChange={v => updateField('scale-type', v)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
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
                        <p className="text-xs text-muted-foreground">Enter `true`, `false`, or a dynamic expression like `${'{form.enable_field}'}`.</p>
                    </div>
                </div>
            );
        }
        
        if (isTextInputComponent) {
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
        return Object.keys(component).map(key => {
            if (!localComponent) return null;
            const value = localComponent[key];
            if (key === 'type' || (key === 'name' && typeof value === 'string' && value.startsWith(component.type.toLowerCase()))) return null; 
            return (
                <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{key}</Label>
                    {typeof value === 'boolean' ? (
                        <Switch id={key} checked={value} onCheckedChange={(val) => updateField(key, val)} />
                    ) : typeof value === 'object' && value !== null ? (
                        <Textarea id={key} value={JSON.stringify(value, null, 2)} onChange={e => { try { updateField(key, JSON.parse(e.target.value)) } catch(err) { /* ignore parse error */}}} className="font-mono text-xs h-32"/>
                    ) : (
                        <Input id={key} value={value ?? ''} onChange={e => updateField(key, e.target.value)} />
                    )}
                </div>
            )
        });
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit Component: {component.type}</DialogTitle>
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

function CreateMetaFlowPage() {
    const searchParams = useSearchParams();
    const flowId = searchParams.get('flowId');
    const isEditing = !!flowId;
    
    const [projectId, setProjectId] = useState<string | null>(null);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [existingFlow, setExistingFlow] = useState<WithId<MetaFlow> | null>(null);
    const [flowData, setFlowData] = useState<any>({ version: '7.1', screens: [], routing_model: {} });
    
    const [category, setCategory] = useState('OTHER');
    const [flowContentJson, setFlowContentJson] = useState('');
    const [shouldPublish, setShouldPublish] = useState(true);
    const [lastApiPayload, setLastApiPayload] = useState<string | null>(null);
    
    const [editingComponent, setEditingComponent] = useState<{ screenIndex: number, componentIndex: number, component: any } | null>(null);
    
    const [flowName, setFlowName] = useState('');

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
        if (!storedProjectId) {
            setIsLoading(false);
            return;
        }

        if (flowId) {
            setIsLoading(true);
            getMetaFlowById(flowId).then(data => {
                if (data) {
                    setExistingFlow(data);
                    setFlowName(data.name);
                    setFlowData(data.flow_data || { version: '7.1', screens: [], routing_model: {} });
                    setCategory(data.categories[0] || 'OTHER');
                    setShouldPublish(data.status === 'PUBLISHED');
                }
                setIsLoading(false);
            });
        } else {
            setFlowName('new_flow');
            setFlowData({
                version: '7.1',
                routing_model: { SCREEN_A: [] },
                screens: [{
                    id: 'SCREEN_A',
                    title: 'Welcome Screen',
                    layout: {
                        type: 'SingleColumnLayout',
                        children: [{
                            type: 'Form',
                            name: 'form_screen_a',
                            children: [{ type: 'TextBody', text: 'This is the start of your flow.' }, { type: 'Footer', label: 'Finish', 'on-click-action': { name: 'complete' } }]
                        }]
                    },
                    terminal: true,
                    success: true,
                }],
            });
            setIsLoading(false);
        }
    }, [flowId]);
    
    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success', description: state.message });
            router.push('/dashboard/flows');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
        if (state?.payload) {
            setLastApiPayload(state.payload);
        }
    }, [state, toast, router]);

    const updateScreenField = useCallback((screenIndex: number, field: string, value: any) => {
        setFlowData((prev: any) => {
            const newScreens = JSON.parse(JSON.stringify(prev.screens));
            
            if (field === 'id' && value !== newScreens[screenIndex].id) {
                const oldId = newScreens[screenIndex].id;
                newScreens[screenIndex][field] = value;
                const newRoutingModel = { ...prev.routing_model };
                if (newRoutingModel[oldId]) {
                    newRoutingModel[value] = newRoutingModel[oldId];
                    delete newRoutingModel[oldId];
                }
                return { ...prev, screens: newScreens, routing_model: newRoutingModel };
            }

            newScreens[screenIndex][field] = value;
            return { ...prev, screens: newScreens };
        });
    }, []);
    
    const addComponentToScreen = (screenIndex: number, componentType: DeclarativeUIComponent['type']) => {
        const newComponent: any = { type: componentType };
        const supportedNameComponents = ['TextInput', 'TextArea', 'DatePicker', 'CalendarPicker', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'ChipsSelector', 'PhotoPicker', 'DocumentPicker', 'ImageCarousel', 'OptIn', 'NavigationList'];
        if (supportedNameComponents.includes(componentType)) {
            newComponent.name = `${componentType.toLowerCase()}_${Date.now()}`;
        }
        if (['TextInput', 'TextArea', 'DatePicker', 'Dropdown', 'RadioButtonsGroup', 'PhotoPicker', 'DocumentPicker'].includes(componentType)) {
            newComponent.label = `New ${componentType}`;
        }
        if (['TextSubheading', 'TextBody', 'TextCaption', 'TextHeading'].includes(componentType)) {
            newComponent.text = `New ${componentType}`;
        }
        if (componentType === 'Image') {
            newComponent.src = 'base64_image_placeholder';
            newComponent['alt-text'] = 'Placeholder image';
        }
        if (componentType === 'ImageCarousel') {
            newComponent.name = `carousel_${Date.now()}`;
            newComponent.images = [{ src: 'base64_image_placeholder', 'alt-text': 'Image 1' }];
        }
        if (['Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'ChipsSelector'].includes(componentType)) {
            newComponent['data-source'] = [{ id: `opt_${Date.now()}`, title: 'Option 1' }];
        }
        if (componentType === 'Footer') {
            newComponent.label = 'Submit';
            newComponent['on-click-action'] = { name: 'complete' };
        }

        setFlowData((prev: any) => {
            const newScreens = JSON.parse(JSON.stringify(prev.screens));
            const screenToUpdate = newScreens[screenIndex];
            const formContainer = screenToUpdate.layout?.children?.find((c: any) => c && c.type === 'Form');
            
            if (formContainer) {
                 if (!formContainer.children) formContainer.children = [];
                 formContainer.children.push(newComponent);
            } else {
                 if (!screenToUpdate.layout.children) screenToUpdate.layout.children = [];
                 screenToUpdate.layout.children.push(newComponent);
            }
            return { ...prev, screens: newScreens };
        });
    };
    
    const removeComponentFromScreen = (screenIndex: number, componentIndex: number) => {
        setFlowData((prev: any) => {
            const newScreens = JSON.parse(JSON.stringify(prev.screens));
            const screenToUpdate = newScreens[screenIndex];
            const formContainer = screenToUpdate.layout?.children?.find((c: any) => c && c.type === 'Form');
    
            if (formContainer && Array.isArray(formContainer.children)) {
                formContainer.children = formContainer.children.filter((_: any, i: number) => i !== componentIndex);
            } else if (Array.isArray(screenToUpdate.layout.children)) {
                 screenToUpdate.layout.children = screenToUpdate.layout.children.filter((_: any, i: number) => i !== componentIndex);
            }
            return { ...prev, screens: newScreens };
        });
    };
    
    const addNewScreen = () => {
        let counter = flowData.screens?.length || 0;
        let newId = '';
        const existingIds = flowData.screens?.map((s: any) => s.id) || [];
        
        do {
            let suffix = '';
            let num = counter;
            if (num === 0 && !existingIds.includes('SCREEN_A')) {
                suffix = 'A';
            } else {
                 while (num >= 0) {
                    suffix = String.fromCharCode(65 + (num % 26)) + suffix;
                    num = Math.floor(num / 26) - 1;
                    if (num < 0) break;
                }
            }
            newId = `SCREEN_${suffix}`;
            counter++;
        } while (existingIds.includes(newId));

        const newScreen = {
            id: newId,
            title: `New Screen`,
            layout: {
                type: 'SingleColumnLayout',
                children: [{
                    type: 'Form', name: `form_${newId}`,
                    children: [{ type: 'TextBody', text: 'This is a new screen.' }, { type: 'Footer', label: 'Submit', 'on-click-action': { name: 'complete' } }]
                }]
            },
            terminal: true,
            success: true,
        };
        setFlowData((prev: any) => ({ ...prev, screens: [...(prev.screens || []), newScreen] }));
    };

    const removeScreen = (screenIndex: number) => {
        setFlowData((prev: any) => ({
            ...prev,
            screens: prev.screens.filter((_: any, i: number) => i !== screenIndex)
        }));
    };
    
    const handleComponentUpdate = (updatedComponent: any) => {
        if (!editingComponent) return;
        setFlowData(prev => {
            const newScreens = JSON.parse(JSON.stringify(prev.screens));
            const formContainer = newScreens[editingComponent.screenIndex].layout?.children?.find((c: any) => c && c.type === 'Form');

            if (formContainer && formContainer.children) {
                formContainer.children[editingComponent.componentIndex] = updatedComponent;
            } else if (newScreens[editingComponent.screenIndex].layout.children) {
                newScreens[editingComponent.screenIndex].layout.children[editingComponent.componentIndex] = updatedComponent;
            }
            return { ...prev, screens: newScreens };
        });
        setEditingComponent(null);
    }
    
    useEffect(() => {
        if (flowData) {
            const newJson = JSON.stringify(flowData, null, 2);
             if (newJson !== flowContentJson) {
                setFlowContentJson(newJson);
            }
        }
    }, [flowData, flowContentJson]);

    useEffect(() => {
        if (!flowData?.screens || !Array.isArray(flowData.screens)) return;

        const newRoutingModel: Record<string, string[]> = {};

        const findNavTargets = (components: any[]): string[] => {
            let targets: string[] = [];
            if (!Array.isArray(components)) return targets;

            for (const component of components.filter(Boolean)) {
                const action = component['on-click-action'] || component['on-select-action'];
                if (action?.name === 'navigate' && action.next?.name) {
                    targets.push(action.next.name);
                }

                if (component.type === 'If' && component.then) {
                    targets = [...targets, ...findNavTargets(component.then)];
                    if (component.else) {
                        targets = [...targets, ...findNavTargets(component.else)];
                    }
                } else if (component.type === 'Switch' && component.cases) {
                    Object.values(component.cases).forEach((caseComponents: any) => {
                        targets = [...targets, ...findNavTargets(caseComponents)];
                    });
                } else if (component.children) {
                    targets = [...targets, ...findNavTargets(component.children)];
                }
            }
            return targets;
        };

        flowData.screens.forEach((screen: any) => {
            if (!screen || !screen.id) return;

            let targets: string[] = [];
            if (screen.layout?.children) {
                targets = findNavTargets(screen.layout.children);
            }
            
            const navList = screen.layout?.children?.find((c: any) => c && c.type === 'NavigationList');
            if (navList) {
                const compAction = navList['on-click-action'];
                if (compAction?.name === 'navigate' && compAction.next?.name) {
                    targets.push(compAction.next.name);
                }
                if (Array.isArray(navList['list-items'])) {
                    navList['list-items'].forEach((item: any) => {
                        const itemAction = item['on-click-action'];
                        if (itemAction?.name === 'navigate' && itemAction.next?.name) {
                            targets.push(itemAction.next.name);
                        }
                    });
                }
            }

            newRoutingModel[screen.id] = [...new Set(targets)];
        });

        setFlowData(prev => ({...prev, routing_model: newRoutingModel}));
    }, [flowData?.screens]);
    
    if (isLoading) return <PageSkeleton />;

    if (!projectId && !isLoading) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard before creating a Meta Flow.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="projectId" value={projectId || ''}/>
            <input type="hidden" name="flowId" value={flowId || ''}/>
            <input type="hidden" name="metaId" value={existingFlow?.metaId || ''}/>
            
            <input type="hidden" name="flowName" value={flowName} />
            <input type="hidden" name="flow_data" value={flowContentJson} />


            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                  <Link href="/dashboard/flows"><ChevronLeft className="mr-2 h-4 w-4" />Back to Meta Flows</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">{isEditing ? 'Edit Meta Flow' : 'Create New Meta Flow'}</h1>
                <p className="text-muted-foreground mt-2">{isEditing ? `Editing flow: ${flowName}` : 'Build interactive forms and experiences for your customers.'}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <ScrollArea className="h-[80vh] pr-4">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>1. General Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="flowNameInput">Flow Name (for Meta)</Label>
                                    <Input id="flowNameInput" value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="e.g., lead_capture_flow" required/>
                                    <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select name="category" value={category} onValueChange={setCategory}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>{flowCategories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch id="publish" name="publish" checked={shouldPublish} onCheckedChange={setShouldPublish} />
                                    <Label htmlFor="publish">Publish this flow</Label>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>2. Build Your Screens</CardTitle>
                                    <Button type="button" size="sm" variant="outline" onClick={addNewScreen}><Plus className="mr-2 h-4 w-4" /> Add Screen</Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Accordion type="multiple" className="w-full space-y-4" defaultValue={['item-0']}>
                                    {(flowData.screens || []).map((screen: any, screenIndex: number) => {
                                        const formContainer = screen.layout?.children?.find((c: any) => c && c.type === 'Form');
                                        const componentsToRender = (formContainer ? (formContainer.children || []) : (screen.layout?.children || [])).filter(Boolean);
                                        
                                        return (
                                        <AccordionItem value={`item-${screenIndex}`} key={screen.id} className="border rounded-md px-4">
                                            <AccordionTrigger className="hover:no-underline">
                                                <div className="flex items-center justify-between w-full">
                                                    <Input className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" value={screen.title || ''} onChange={e => updateScreenField(screenIndex, 'title', e.target.value)} onClick={e => e.stopPropagation()}/>
                                                    {flowData.screens.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeScreen(screenIndex); }}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-4 space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`screen-id-${screen.id}`}>Screen ID</Label>
                                                    <Input
                                                        id={`screen-id-${screen.id}`}
                                                        value={screen.id}
                                                        onChange={e => updateScreenField(screenIndex, 'id', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                                        className="font-mono"
                                                    />
                                                    <p className="text-xs text-muted-foreground">Unique ID for this screen. Uppercase letters, numbers, and underscores only.</p>
                                                </div>
                                                <div className="flex items-center justify-end gap-6 text-sm">
                                                    <div className="flex items-center gap-2"><Label htmlFor={`terminal-${screen.id}`}>Terminal Screen</Label><Switch id={`terminal-${screen.id}`} checked={!!screen.terminal} onCheckedChange={(val) => updateScreenField(screenIndex, 'terminal', val)}/></div>
                                                    <div className="flex items-center gap-2"><Label htmlFor={`success-${screen.id}`}>Success Screen</Label><Switch id={`success-${screen.id}`} checked={!!screen.success} onCheckedChange={(val) => updateScreenField(screenIndex, 'success', val)}/></div>
                                                </div>
                                                <h4 className="font-semibold text-sm">Components</h4>
                                                {componentsToRender.map((component: any, compIndex: number) => (
                                                    <div key={component.name || compIndex} className="p-3 border rounded-lg space-y-2 relative bg-background">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-sm font-medium text-muted-foreground">{component.type}</p>
                                                            <div>
                                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingComponent({screenIndex, componentIndex: compIndex, component})}><Settings className="h-3 w-3" /></Button>
                                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComponentFromScreen(screenIndex, compIndex)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate">Name: {component.name || 'N/A'}, Label: {component.label || component.text || 'N/A'}</p>
                                                    </div>
                                                ))}
                                                <Popover>
                                                    <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Component</Button></PopoverTrigger>
                                                    <PopoverContent className="w-56 p-1"><ScrollArea className="h-64">{declarativeFlowComponents.map(c => <div key={c.type} className="p-2 text-sm rounded-md hover:bg-accent cursor-pointer" onClick={() => addComponentToScreen(screenIndex, c.type)}>{c.label}</div>)}</ScrollArea></PopoverContent>
                                                </Popover>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )})}
                                </Accordion>
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>
                
                <div className="lg:sticky top-6">
                    <MetaFlowPreview flowJson={flowContentJson} />
                </div>
            </div>

            <Accordion type="single" collapsible>
                <AccordionItem value="json-preview">
                    <AccordionTrigger><div className="flex items-center gap-2"><FileJson className="h-4 w-4"/> View Generated JSON</div></AccordionTrigger>
                    <AccordionContent><pre className="p-4 bg-muted/50 rounded-md text-xs font-mono max-h-96 overflow-y-auto">{flowContentJson}</pre></AccordionContent>
                </AccordionItem>
            </Accordion>
             
            <Accordion type="single" collapsible>
                <AccordionItem value="api-payload-preview">
                    <AccordionTrigger disabled={!lastApiPayload}>
                        <div className="flex items-center gap-2"><Server className="h-4 w-4"/> View Last API Payload</div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <pre className="p-4 bg-muted/50 rounded-md text-xs font-mono max-h-96 overflow-y-auto">
                            {lastApiPayload || 'Submit the flow to see the payload that was sent to Meta.'}
                        </pre>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
             <ComponentEditorDialog 
                isOpen={!!editingComponent}
                onOpenChange={(open) => !open && setEditingComponent(null)}
                component={editingComponent?.component}
                onSave={handleComponentUpdate}
                onCancel={() => setEditingComponent(null)}
            />

            <div className="flex justify-end"><SubmitButton isEditing={isEditing} /></div>
        </form>
    );
}

export default function CreateMetaFlowPageWrapper() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CreateMetaFlowPage />
    </Suspense>
  )
}
