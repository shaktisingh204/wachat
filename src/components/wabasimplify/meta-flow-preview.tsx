
'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { MoreVertical, ArrowLeft, CheckCircle, Circle, Square, CheckSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';

const FlowComponent = ({ component, formData, setFormData }: { component: any, formData: Record<string, any>, setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>> }) => {
    const name = component.name;
    const value = formData[name] || '';

    const handleChange = (val: string | boolean | string[]) => {
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    switch (component.type) {
        case 'TextHeading':
            return <h2 className="text-xl font-bold text-gray-800">{component.text}</h2>;
        case 'TextSubheading':
            return <h3 className="text-lg font-semibold text-gray-700">{component.text}</h3>;
        case 'TextBody':
            return <p className="text-sm text-gray-600">{component.text}</p>;
        case 'TextCaption':
            return <p className="text-xs text-gray-500">{component.text}</p>;
        case 'TextInput':
        case 'PhoneNumber':
             return <div className="space-y-1 w-full"><Label htmlFor={name} className="text-sm font-medium text-gray-700">{component.label}</Label><Input id={name} name={name} placeholder={component.placeholder} value={value} onChange={e => handleChange(e.target.value)} className="bg-gray-50"/></div>;
        case 'RadioButtonsGroup':
            return (
                <div className="w-full space-y-2">
                    <Label className="text-sm font-medium text-gray-700">{component.label}</Label>
                    <RadioGroup name={name} value={value} onValueChange={handleChange} className="space-y-1">
                        {(component['data-source'] || []).map((opt: any) => (
                            <div key={opt.id} className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50">
                                <Label htmlFor={`${name}-${opt.id}`} className="font-normal text-sm text-gray-800 flex-1">{opt.title}</Label>
                                <RadioGroupItem value={opt.id} id={`${name}-${opt.id}`} />
                            </div>
                        ))}
                    </RadioGroup>
                </div>
            );
         case 'CheckboxGroup':
            const currentValues = (formData[name] || []) as string[];
            const handleCheckboxChange = (id: string, checked: boolean) => {
                const newValues = checked ? [...currentValues, id] : currentValues.filter(v => v !== id);
                handleChange(newValues);
            };
            return (
                <div className="w-full space-y-2">
                    <Label className="text-sm font-medium text-gray-700">{component.label}</Label>
                    <div className="space-y-1">
                        {(component['data-source'] || []).map((opt: any) => (
                             <div key={opt.id} className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50">
                                <Label htmlFor={`${name}-${opt.id}`} className="font-normal text-sm text-gray-800 flex-1">{opt.title}</Label>
                                <Checkbox id={`${name}-${opt.id}`} checked={currentValues.includes(opt.id)} onCheckedChange={(checked) => handleCheckboxChange(opt.id, !!checked)} />
                            </div>
                        ))}
                    </div>
                </div>
            );
        case 'NavigationList':
            return (
                <div className="w-full space-y-1">
                    <Label className="text-sm font-medium text-gray-700">{component.label}</Label>
                    <p className="text-xs text-gray-500 pb-2">{component.description}</p>
                    {(component['list-items'] || []).map((item: any) => (
                         <div key={item.id} className="flex items-center justify-between p-3 border-b hover:bg-gray-50 cursor-pointer">
                            <div className="flex-1">
                                <p className="font-semibold text-sm text-gray-800">{item['main-content']?.title}</p>
                                <p className="text-xs text-gray-500">{item['main-content']?.description}</p>
                            </div>
                            <Circle className="h-5 w-5 text-gray-400" />
                        </div>
                    ))}
                </div>
            );
        case 'Image':
             return (
                <div className="w-full">
                    {component.src ? (
                        <Image src={component.src} alt={component['alt-text'] || 'flow-image'} width={400} height={225} className="rounded-md object-cover w-full h-auto"/>
                    ) : (
                        <div className="h-40 bg-gray-100 rounded-md flex items-center justify-center text-muted-foreground text-sm">Image Preview</div>
                    )}
                </div>
            );
        case 'EmbeddedLink':
            return <Button variant="link" className="p-0 h-auto justify-start text-sm text-green-600">{component.text}</Button>
        default: return <p className="text-xs italic text-gray-400">Preview for {component.type} not available.</p>;
    }
}

const ChatBubble = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-white rounded-lg p-2 max-w-sm shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
        {children}
    </div>
);

export const MetaFlowPreview = ({ flowJson }: { flowJson: string }) => {
    const [flowData, setFlowData] = useState<any>(null);
    const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            if (flowJson) {
                const parsed = JSON.parse(flowJson);
                setFlowData(parsed);
                if (!currentScreenId || !parsed.screens.some((s: any) => s.id === currentScreenId)) {
                    setCurrentScreenId(parsed.screens?.[0]?.id);
                }
                setError(null);
            }
        } catch (e) {
            setError('Invalid JSON format for flow data.');
            setFlowData(null);
        }
    }, [flowJson, currentScreenId]);

    if (error) {
        return <Card className="h-full flex items-center justify-center p-4"><p className="text-destructive text-center">{error}</p></Card>
    }
    if (!flowData || !currentScreenId) {
        return <Card className="h-full flex items-center justify-center p-4"><p className="text-muted-foreground text-center">No flow data to preview.</p></Card>
    }

    const currentScreen = flowData.screens.find((s: any) => s.id === currentScreenId);
    if (!currentScreen) {
        return <Card className="h-full flex items-center justify-center p-4"><p className="text-destructive text-center">Current screen not found!</p></Card>
    }
    
    const layout = currentScreen.layout;
    const safeLayoutChildren = layout?.children?.filter(Boolean) || [];
    const mainContainer = safeLayoutChildren.find((c: any) => c && (c.type === 'Form' || c.type === 'NavigationList'));
    
    let renderableComponents: any[] = [];
    let footerComponent: any = null;

    if (mainContainer && mainContainer.type === 'Form') {
        renderableComponents = mainContainer.children?.filter(Boolean) || [];
        footerComponent = renderableComponents.find(c => c && c.type === 'Footer');
    } else {
        renderableComponents = safeLayoutChildren;
        footerComponent = renderableComponents.find(c => c && c.type === 'Footer');
    }

    const handleAction = (action: any) => {
        if (!action) return;
        if (action.name === 'navigate' && action.next?.name) {
            if(flowData.screens.some((s: any) => s.id === action.next.name)) {
               setCurrentScreenId(action.next.name);
            } else {
                alert("Test Flow: Next screen not found!");
            }
        } else if(action.name === 'complete') {
            alert(`Flow Submitted (Test Mode)\nData: ${JSON.stringify(formData, null, 2)}`);
        }
    }

    return (
       <div className="w-full max-w-[360px] mx-auto shadow-2xl rounded-3xl overflow-hidden h-full flex flex-col bg-[#E7E5DE] relative">
            {/* Phone Top Bar */}
            <div className="bg-gray-100 p-2 text-xs font-mono text-gray-500 flex justify-between">
                <span>12:30</span>
                <span>📶 LTE</span>
            </div>
            {/* WhatsApp Header */}
            <div className="bg-gray-100 p-2 flex items-center justify-between border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <ArrowLeft className="h-5 w-5 text-gray-700" />
                    <Avatar className="h-8 w-8"><AvatarFallback>E</AvatarFallback></Avatar>
                    <div>
                        <p className="font-semibold text-sm text-gray-800">Ecoshop</p>
                        <p className="text-xs text-gray-500">Business Account</p>
                    </div>
                </div>
                <MoreVertical className="h-5 w-5 text-gray-700" />
            </div>

            {/* Chat Content */}
            <ScrollArea className="flex-1 p-3 space-y-3">
                <div className="flex justify-center my-2">
                    <div className="bg-[#D2F2D4] rounded-md px-2 py-0.5 text-xs text-gray-600 shadow-sm">
                        TODAY
                    </div>
                </div>
                 <div className="flex justify-center">
                    <div className="bg-[#FEFDE1] rounded-md px-3 py-2 text-xs text-[#7D6B39] text-center max-w-xs shadow-sm">
                        🔒 This business uses a secure service from Meta to manage this chat. Learn more.
                    </div>
                </div>
                <div className="flex justify-start">
                    <ChatBubble>
                         <div className="p-2 space-y-2">
                            <p className="text-sm">Welcome! Tap the button below to start.</p>
                            <Button size="sm" className="w-full bg-white text-blue-500 border-t border-gray-200 rounded-t-none -m-2 mt-2" onClick={() => setCurrentScreenId(flowData.screens?.[0]?.id)}>Start Shopping</Button>
                        </div>
                    </ChatBubble>
                </div>

                 <div className="flex justify-end">
                    <div className="bg-[#E2F7CB] rounded-lg p-2 max-w-sm shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
                        <p className="text-sm">Start Shopping</p>
                    </div>
                 </div>
            </ScrollArea>
           
            {/* Flow Screen Modal */}
            <div className="absolute inset-0 bg-black/30 flex flex-col justify-end">
                <div className="bg-white rounded-t-xl h-[95%] flex flex-col animate-slide-in-up" style={{ animationDelay: '3.3s' }}>
                    <CardHeader className="p-3 flex flex-row items-center justify-between border-b flex-shrink-0">
                        <Button variant="ghost" size="icon" className="text-gray-600"><ArrowLeft className="h-5 w-5" /></Button>
                        <p className="font-semibold text-gray-800">{currentScreen.title || 'Flow Preview'}</p>
                        <Button variant="ghost" size="icon" className="text-gray-600"><MoreVertical className="h-5 w-5" /></Button>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <CardContent className="p-4 space-y-4">
                            {renderableComponents.filter(c => c && c.type !== 'Footer').map((component: any, index: number) => (
                                <FlowComponent key={component.name || index} component={component} formData={formData} setFormData={setFormData} />
                            ))}
                        </CardContent>
                    </ScrollArea>
                    {footerComponent && (
                        <CardFooter className="p-4 bg-white border-t flex-col items-center flex-shrink-0 space-y-2">
                             <Button 
                                onClick={() => handleAction(footerComponent['on-click-action'])} 
                                size="lg" 
                                className="w-full bg-[#00A884] hover:bg-[#00A884]/90"
                                disabled={!footerComponent.enabled}
                            >
                                {footerComponent.label}
                            </Button>
                            <p className="text-xs text-gray-500">Managed by Ecoshop. <span className="text-blue-500">Learn more</span></p>
                        </CardFooter>
                    )}
                </div>
            </div>
       </div>
    );
}
