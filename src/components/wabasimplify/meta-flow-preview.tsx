
'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MoreVertical, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const FlowComponent = ({ component, formData, setFormData }) => {
    const { id, label } = component;
    const value = formData[id] || '';

    const handleChange = (val: string | boolean) => {
        setFormData(prev => ({ ...prev, [id]: val }));
    };

    switch (component.type) {
        case 'TextInput':
        case 'NumberInput':
        case 'UrlInput':
             return <div className="space-y-1 w-full"><Label htmlFor={id} className="text-sm font-medium">{label}</Label><Input id={id} name={id} placeholder={component.placeholder} value={value} onChange={e => handleChange(e.target.value)} className="bg-gray-50"/></div>;
        case 'TimePicker':
            return <div className="space-y-1 w-full"><Label htmlFor={id} className="text-sm font-medium">{label}</Label><Input id={id} name={id} type="time" value={value} onChange={e => handleChange(e.target.value)} className="bg-gray-50"/></div>;
        case 'Calendar':
            return <div className="space-y-1 w-full"><Label htmlFor={id} className="text-sm font-medium">{label}</Label><Input id={id} name={id} type="date" value={value} onChange={e => handleChange(e.target.value)} className="bg-gray-50"/></div>;
        case 'ChipsSelector':
             return <div className="w-full space-y-2"><Label className="text-sm font-medium">{label}</Label><div className="flex flex-wrap gap-2">{(component.options || []).map(opt => <Button key={opt.id} variant={value.includes(opt.id) ? 'default': 'outline'} size="sm" onClick={() => { const current = value || []; const newSelection = current.includes(opt.id) ? current.filter(i => i !== opt.id) : [...current, opt.id]; handleChange(newSelection); }}>{opt.label}</Button>)}</div></div>;
        case 'RadioSelector':
            return <div className="w-full space-y-2"><Label className="text-sm font-medium">{label}</Label><RadioGroup name={id} value={value} onValueChange={handleChange}>{(component.options || []).map(opt => <div key={opt.id} className="flex items-center space-x-2"><RadioGroupItem value={opt.id} id={`${id}-${opt.id}`}/><Label htmlFor={`${id}-${opt.id}`} className="font-normal text-sm">{opt.label}</Label></div>)}</RadioGroup></div>;
        case 'ListSelector':
            return <div className="w-full space-y-2"><Label className="text-sm font-medium">{label}</Label><Select onValueChange={handleChange}><SelectTrigger className="w-full bg-gray-50"><SelectValue placeholder="Select an option"/></SelectTrigger><SelectContent>{(component.options || []).map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}</SelectContent></Select></div>;
        default: return null;
    }
}

export const MetaFlowPreview = ({ flowJson }) => {
    const [flowData, setFlowData] = useState<any>(null);
    const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            if (flowJson) {
                const parsed = JSON.parse(flowJson);
                setFlowData(parsed.flow);
                if (!currentScreenId || !parsed.flow.screens.some(s => s.id === currentScreenId)) {
                    setCurrentScreenId(parsed.flow.screens?.[0]?.id);
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
    
    const components = currentScreen.components || [];
    const button = components.find(c => c.type === 'Button');

    const handleAction = () => {
        if (button) {
            const action = button.action;
            if (action.type === 'navigate' && action.target) {
                if(flowData.screens.some(s => s.id === action.target)) {
                   setCurrentScreenId(action.target);
                } else {
                    alert("Test Flow: Next screen not found!");
                }
            } else if(action.type === 'submit') {
                alert(`Flow Submitted (Test Mode)\nData: ${JSON.stringify(formData, null, 2)}`);
            }
        }
    }

    return (
        <Card className="w-full max-w-[360px] mx-auto shadow-2xl rounded-3xl overflow-hidden h-[720px] flex flex-col bg-gray-200">
            <CardHeader className="bg-white p-3 flex flex-row items-center justify-between border-b flex-shrink-0">
                <div className="flex items-center gap-3">
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                    <p className="font-semibold text-gray-800">{currentScreen.title?.text || 'Flow Preview'}</p>
                </div>
                <MoreVertical className="h-5 w-5 text-gray-600" />
            </CardHeader>
            <CardContent className="flex-1 bg-white">
                <ScrollArea className="h-full w-full">
                    <div className="p-4 space-y-4">
                        {currentScreen.body?.text && <p className="text-sm text-gray-600">{currentScreen.body.text}</p>}
                        {components.map((component: any, index: number) => (
                            <FlowComponent key={component.id || index} component={component} formData={formData} setFormData={setFormData} />
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
            {button && (
                <CardFooter className="p-4 bg-white border-t flex-shrink-0">
                    <Button onClick={handleAction} size="lg" className="w-full bg-green-600 hover:bg-green-700">{button.label}</Button>
                </CardFooter>
            )}
        </Card>
    );
}

    