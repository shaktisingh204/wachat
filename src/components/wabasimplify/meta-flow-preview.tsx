
'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MoreVertical, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const FlowComponent = ({ component, formData, setFormData }: { component: any, formData: Record<string, any>, setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>> }) => {
    const name = component.name;
    const value = formData[name] || '';

    const handleChange = (val: string | boolean) => {
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    switch (component.type) {
        case 'TextSubheading':
        case 'TextHeading':
        case 'TextBody':
        case 'TextCaption':
            return <p className={`
                ${component.type === 'TextHeading' ? 'text-lg font-bold' : ''}
                ${component.type === 'TextSubheading' ? 'text-base font-semibold' : ''}
                ${component.type === 'TextBody' ? 'text-sm' : ''}
                ${component.type === 'TextCaption' ? 'text-xs text-muted-foreground' : ''}
            `}>{component.text}</p>;
        case 'TextArea':
            return <div className="space-y-1 w-full"><Label htmlFor={name} className="text-sm font-medium">{component.label}</Label><Textarea id={name} name={name} placeholder={component.placeholder} value={value} onChange={e => handleChange(e.target.value)} className="bg-gray-50"/></div>;
        case 'TextInput':
        case 'PhoneNumber':
             return <div className="space-y-1 w-full"><Label htmlFor={name} className="text-sm font-medium">{component.label}</Label><Input id={name} name={name} placeholder={component.placeholder} value={value} onChange={e => handleChange(e.target.value)} className="bg-gray-50"/></div>;
        case 'DatePicker':
            return <div className="space-y-1 w-full"><Label htmlFor={name} className="text-sm font-medium">{component.label}</Label><Input id={name} name={name} type="date" value={value} onChange={e => handleChange(e.target.value)} className="bg-gray-50"/></div>;
        case 'RadioButtonsGroup':
            return <div className="w-full space-y-2"><Label className="text-sm font-medium">{component.label}</Label><RadioGroup name={name} value={value} onValueChange={handleChange}>{(component['data-source'] || []).map((opt: any) => <div key={opt.id} className="flex items-center space-x-2"><RadioGroupItem value={opt.id} id={`${name}-${opt.id}`}/><Label htmlFor={`${name}-${opt.id}`} className="font-normal text-sm">{opt.title}</Label></div>)}</RadioGroup></div>;
        case 'Dropdown':
            return <div className="w-full space-y-2"><Label className="text-sm font-medium">{component.label}</Label><Select onValueChange={handleChange}><SelectTrigger className="w-full bg-gray-50"><SelectValue placeholder="Select an option"/></SelectTrigger><SelectContent>{(component['data-source'] || []).map((opt: any) => <SelectItem key={opt.id} value={opt.id}>{opt.title}</SelectItem>)}</SelectContent></Select></div>;
        case 'NavigationList':
            return (
                <div className="w-full space-y-1">
                    {(component['list-items'] || []).map((item: any) => (
                         <div key={item.id} className="p-3 border-b hover:bg-gray-50 cursor-pointer">
                            <p className="font-semibold">{item['main-content']?.title}</p>
                            <p className="text-xs text-muted-foreground">{item['main-content']?.description}</p>
                        </div>
                    ))}
                </div>
            );
        default: return null;
    }
}

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
        <Card className="w-full max-w-[360px] mx-auto shadow-2xl rounded-3xl overflow-hidden h-[720px] flex flex-col bg-gray-200">
            <CardHeader className="bg-white p-3 flex flex-row items-center justify-between border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                    <p className="font-semibold text-gray-800">{currentScreen.title || 'Flow Preview'}</p>
                </div>
                <MoreVertical className="h-5 w-5 text-gray-600" />
            </CardHeader>
            <CardContent className="flex-1 bg-white">
                <ScrollArea className="h-full w-full">
                    <div className="p-4 space-y-4">
                        {renderableComponents.filter(c => c && c.type !== 'Footer').map((component: any, index: number) => (
                            <FlowComponent key={component.name || index} component={component} formData={formData} setFormData={setFormData} />
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
            {footerComponent && (
                <CardFooter className="p-4 bg-white border-t flex-shrink-0">
                    <Button onClick={() => handleAction(footerComponent['on-click-action'])} size="lg" className="w-full bg-green-600 hover:bg-green-700">{footerComponent.label}</Button>
                </CardFooter>
            )}
        </Card>
    );
}

