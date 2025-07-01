
'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, MoreVertical, ArrowLeft, ArrowRight } from 'lucide-react';
import Image from 'next/image';

const FlowComponent = ({ component, formData, setFormData }) => {
    switch (component.type) {
        case 'TextHeading': return <h2 className="text-xl font-bold text-gray-800">{component.text}</h2>;
        case 'TextBody': return <p className="text-gray-600">{component.text}</p>;
        case 'TextSubtext': return <p className="text-xs text-gray-500">{component.text}</p>;
        case 'Image': return <div className="relative aspect-video w-full rounded-lg overflow-hidden my-2"><Image src={component.url || 'https://placehold.co/600x400.png'} alt={component.caption || 'Flow image'} layout="fill" objectFit="cover" data-ai-hint="house loan" />{component.caption && <p className="text-xs text-center p-1 bg-black/50 text-white absolute bottom-0 w-full">{component.caption}</p>}</div>;
        case 'TextInput': return <div className="space-y-1 w-full"><Label htmlFor={component.name} className="text-xs text-gray-500">{component.label}</Label><Input id={component.name} name={component.name} placeholder={component['input-type'] === 'number' ? '0' : 'Enter value...'} type={component['input-type']} value={formData[component.name] || ''} onChange={(e) => setFormData(prev => ({...prev, [component.name]: e.target.value}))} className="bg-gray-50"/></div>;
        case 'DatePicker': return <div className="space-y-1 w-full"><Label htmlFor={component.name} className="text-xs text-gray-500">{component.label}</Label><Input id={component.name} name={component.name} type="date" value={formData[component.name] || ''} onChange={(e) => setFormData(prev => ({...prev, [component.name]: e.target.value}))} className="bg-gray-50"/></div>;
        case 'RadioButtons': return <div className="w-full space-y-2"><Label className="text-sm font-medium">{component.label}</Label><RadioGroup name={component.name} value={formData[component.name]} onValueChange={val => setFormData(prev => ({ ...prev, [component.name]: val }))}>{(component['data-source'] || []).map(opt => <div key={opt.id} className="flex items-center space-x-2"><RadioGroupItem value={opt.id} id={`${component.name}-${opt.id}`}/><Label htmlFor={`${component.name}-${opt.id}`} className="font-normal">{opt.title}</Label></div>)}</RadioGroup></div>;
        case 'CheckboxGroup': return <div className="w-full space-y-2"><Label className="text-sm font-medium">{component.label}</Label><div className="space-y-1">{(component['data-source'] || []).map(opt => <div key={opt.id} className="flex items-center space-x-2"><Checkbox id={`${component.name}-${opt.id}`} onCheckedChange={checked => setFormData(prev => ({...prev, [component.name]: {...(prev[component.name] || {}), [opt.id]: checked}}))} /><Label htmlFor={`${component.name}-${opt.id}`} className="font-normal">{opt.title}</Label></div>)}</div></div>;
        case 'Dropdown': return <div className="w-full space-y-2"><Label className="text-sm font-medium">{component.label}</Label><Select onValueChange={val => setFormData(prev => ({...prev, [component.name]: val}))}><SelectTrigger className="w-full"><SelectValue placeholder="Select an option"/></SelectTrigger><SelectContent>{(component['data-source'] || []).map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.title}</SelectItem>)}</SelectContent></Select></div>;
        case 'OptIn': return <div className="flex items-start space-x-2"><Checkbox id={component.name} onCheckedChange={checked => setFormData(prev => ({ ...prev, [component.name]: checked }))} /><Label htmlFor={component.name} className="text-xs font-normal">{component.label}</Label></div>;
        default: return <div className="p-2 my-1 text-xs text-red-500 bg-red-100 rounded-md">Unsupported preview for: {component.type}</div>;
    }
}

export const MetaFlowPreview = ({ flowJson }) => {
    const [flowData, setFlowData] = useState(null);
    const [currentScreenId, setCurrentScreenId] = useState(null);
    const [formData, setFormData] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        try {
            if (flowJson) {
                const parsed = JSON.parse(flowJson);
                setFlowData(parsed);
                if (!currentScreenId || !parsed.screens.some(s => s.id === currentScreenId)) {
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

    const currentScreen = flowData.screens.find(s => s.id === currentScreenId);
    if (!currentScreen) {
        return <Card className="h-full flex items-center justify-center p-4"><p className="text-destructive text-center">Current screen not found!</p></Card>
    }

    const handleAction = () => {
        const footer = currentScreen.layout.children.find(c => c.type === 'Footer');
        if (footer) {
            const action = footer['on-click-action'];
            if ((action.name === 'next' || action.name === 'navigate') && action.payload?.next) {
                if(flowData.screens.some(s => s.id === action.payload.next)) {
                   setCurrentScreenId(action.payload.next);
                } else {
                    alert("Test Flow: Next screen not found!");
                }
            } else if(action.name === 'complete') {
                alert(`Flow Completed (Test Mode)\nData: ${JSON.stringify(formData, null, 2)}`);
            }
        }
    }
    
    const footer = currentScreen.layout.children.find(c => c.type === 'Footer');

    return (
        <Card className="w-full max-w-[360px] mx-auto shadow-2xl rounded-3xl overflow-hidden h-[720px] flex flex-col bg-gray-200">
            <CardHeader className="bg-white p-3 flex flex-row items-center justify-between border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                    <X className="h-5 w-5 text-gray-600" />
                    <p className="font-semibold text-gray-800">{currentScreen.title || 'Flow Preview'}</p>
                </div>
                <MoreVertical className="h-5 w-5 text-gray-600" />
            </CardHeader>
            <CardContent className="flex-1 p-4 bg-white overflow-y-auto space-y-4">
                {currentScreen.layout.children.map((component, index) => (
                    component.type !== 'Footer' && <FlowComponent key={component.id || index} component={component} formData={formData} setFormData={setFormData} />
                ))}
            </CardContent>
            {footer && (
                <CardFooter className="p-4 bg-white border-t flex flex-col items-stretch gap-2 flex-shrink-0">
                    <Button onClick={handleAction} size="lg" className="w-full bg-green-600 hover:bg-green-700">{footer.label}</Button>
                    <p className="text-xs text-center text-gray-500">Managed by the business. Learn more</p>
                </CardFooter>
            )}
             <div className="bg-gray-200 p-2 flex items-center justify-center flex-shrink-0">
                 <div className="flex items-center justify-between w-32">
                    <Button variant="ghost" size="icon" className="text-gray-500"><ArrowLeft/></Button>
                    <div className="h-5 w-5 rounded-full border-2 border-gray-500"></div>
                    <Button variant="ghost" size="icon" className="text-gray-500"><ArrowRight/></Button>
                 </div>
            </div>
        </Card>
    );
}
