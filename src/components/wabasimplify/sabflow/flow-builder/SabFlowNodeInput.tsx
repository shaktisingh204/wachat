
'use client';

import { DynamicSelector } from '@/components/wabasimplify/sabflow/dynamic-selector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface NodeInputProps {
    input: any;
    value: any;
    onChange: (val: any) => void;
    dataOptions: any;
}

export function SabFlowNodeInput({ input, value, onChange, dataOptions }: NodeInputProps) {
    if (input.type === 'dynamic-selector') {
        return (
            <DynamicSelector
                value={value}
                onChange={onChange}
                options={dataOptions[input.fetch] || []}
                placeholder={input.placeholder}
            />
        );
    }

    if (input.type === 'project-selector') {
        const options = input.appType === 'facebook' ? dataOptions.facebookProjects : dataOptions.projects;
        return (
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
                <SelectContent>
                    {options && options.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                    {(!options || options.length === 0) && <div className="p-2 text-sm text-muted-foreground">No projects found</div>}
                </SelectContent>
            </Select>
        );
    }

    if (input.type === 'agent-selector') {
        const options = dataOptions.agents;
        return (
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger><SelectValue placeholder="Select an agent..." /></SelectTrigger>
                <SelectContent>
                    {options && options.map((opt: any) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    if (input.type === 'boolean' || input.type === 'toggle') {
        return (
            <div className="flex items-center space-x-2">
                <Switch
                    checked={value === true}
                    onCheckedChange={onChange}
                />
                <Label>{value ? 'Yes' : 'No'}</Label>
            </div>
        )
    }

    switch (input.type) {
        case 'textarea':
            return <Textarea placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} rows={4} />;
        case 'number':
            return <Input type="number" placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
        case 'date':
            return <Input type="date" placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
        case 'time':
            return <Input type="time" placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
        case 'password':
            return <Input type="password" placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
        default:
            return <Input type={input.type || 'text'} placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
    }
}
