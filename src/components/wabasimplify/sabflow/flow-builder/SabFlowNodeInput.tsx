'use client';

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMemo, useRef } from "react";
import { SabFlowVariableInserter, SabFlowVariable } from "./SabFlowVariableInserter";
import { DynamicSelector } from '@/components/wabasimplify/sabflow/dynamic-selector';
import { SabFlowCombobox } from "./SabFlowCombobox";
import { Plus } from "lucide-react";

interface SabFlowNodeInputProps {
    input: any;
    value: any;
    onChange: (value: any) => void;
    error?: string;
    dataOptions?: any; // For passing dynamic options like projects, templates, tags
    availableVariables?: SabFlowVariable[];
}

export function SabFlowNodeInput({ input, value, onChange, error, dataOptions = {}, availableVariables = [] }: SabFlowNodeInputProps) {

    const handleInsertVariable = (variable: string, currentValue: string, fieldType: 'text' | 'textarea' | 'json') => {
        // Simple append for now
        const newValue = currentValue ? `${currentValue} ${variable}` : variable;
        onChange(newValue);
    };

    const renderInput = () => {
        switch (input.type) {
            case 'text':
                return (
                    <div className="relative flex items-center gap-1">
                        <Input
                            placeholder={input.placeholder}
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            className={cn(error ? "border-destructive bg-background/50" : "bg-background/50 focus:bg-background transition-colors", "pr-8")} // Make room for icon
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10">
                            <SabFlowVariableInserter
                                onInsert={(v) => handleInsertVariable(v, value || '', 'text')}
                                availableVariables={availableVariables}
                            />
                        </div>
                    </div>
                );
            case 'number':
                return <Input type="number" placeholder={input.placeholder} value={value || ''} onChange={e => onChange(Number(e.target.value))} className={error ? "border-destructive bg-background/50" : "bg-background/50 focus:bg-background transition-colors"} />;
            case 'password':
                return <Input type="password" placeholder={input.placeholder} value={value || ''} onChange={e => onChange(e.target.value)} className={error ? "border-destructive bg-background/50" : "bg-background/50 focus:bg-background transition-colors"} />;
            case 'textarea':
                return (
                    <div className="relative">
                        <Textarea
                            placeholder={input.placeholder}
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            rows={4}
                            className={cn(error ? "border-destructive bg-background/50" : "bg-background/50 focus:bg-background transition-colors", "pr-8")}
                        />
                        <div className="absolute right-2 top-2 z-10">
                            <SabFlowVariableInserter
                                onInsert={(v) => handleInsertVariable(v, value || '', 'textarea')}
                                availableVariables={availableVariables}
                            />
                        </div>
                    </div>
                );
            case 'json-editor':
                return (
                    <div className="relative">
                        <Textarea
                            placeholder={input.placeholder}
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            rows={6}
                            className={cn("font-mono text-xs resize-y", error ? "border-destructive bg-background/50" : "bg-background/50 focus:bg-background transition-colors", "pr-8")}
                        />
                        <div className="absolute right-2 top-2 z-10 flex flex-col gap-2">
                            <div className="text-[10px] text-muted-foreground bg-background/80 px-1 rounded border self-end">JSON</div>
                            <SabFlowVariableInserter
                                onInsert={(v) => handleInsertVariable(v, value || '', 'json')}
                                availableVariables={availableVariables}
                            />
                        </div>
                    </div>
                );
            case 'boolean':
                return <Switch checked={!!value} onCheckedChange={onChange} />;
            case 'select':
                return (
                    <Select value={value} onValueChange={onChange}>
                        <SelectTrigger className={error ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            {input.options?.map((opt: any) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'project-selector':
                const projectOptions = input.appType === 'facebook' ? dataOptions.facebookProjects : dataOptions.projects;
                const isEmpty = !projectOptions || projectOptions.length === 0;
                // Determine target URL based on appType
                const connectUrl = input.appType === 'facebook'
                    ? '/dashboard/facebook/all-projects'
                    : '/dashboard';

                return (
                    <div className="space-y-2">
                        <Select value={value} onValueChange={onChange}>
                            <SelectTrigger className={error ? "border-destructive" : ""}>
                                <SelectValue placeholder="Select Project" />
                            </SelectTrigger>
                            <SelectContent>
                                {projectOptions && projectOptions.map((opt: any) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                                {isEmpty && <div className="p-2 text-xs text-muted-foreground text-center">No projects found</div>}
                            </SelectContent>
                        </Select>
                        {isEmpty && (
                            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                                <a href={connectUrl} target="_blank" rel="noopener noreferrer">
                                    <Plus className="mr-2 h-3 w-3" />
                                    Connect New Project
                                </a>
                            </Button>
                        )}
                    </div>
                );
            case 'template-selector':
                const templateOptions = dataOptions.templates || [];
                return (
                    <Select value={value} onValueChange={onChange}>
                        <SelectTrigger className={error ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select Template" />
                        </SelectTrigger>
                        <SelectContent>
                            {templateOptions.map((opt: any) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                            {templateOptions.length === 0 && <div className="p-2 text-sm text-muted-foreground">No templates found for this project</div>}
                        </SelectContent>
                    </Select>
                );
            case 'tag-selector':
                const tagOptions = dataOptions.tags || [];
                return (
                    <Select value={value} onValueChange={onChange}>
                        <SelectTrigger className={error ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select Tag" />
                        </SelectTrigger>
                        <SelectContent>
                            {tagOptions.map((opt: any) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                            {tagOptions.length === 0 && <div className="p-2 text-sm text-muted-foreground">No tags found</div>}
                        </SelectContent>
                    </Select>
                );
            case 'dynamic-selector':
                // Keep fallback for other dynamic types if any, using DynamicSelector if available or Select
                if (dataOptions[input.fetch]) {
                    return (
                        <Select value={value} onValueChange={onChange}>
                            <SelectTrigger className={error ? "border-destructive" : ""}>
                                <SelectValue placeholder={`Select ${input.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {dataOptions[input.fetch].map((opt: any) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )
                }
                return <div className="text-sm text-muted-foreground">Dynamic Selector: {input.fetch} (Data not loaded)</div>;
            default:
                return <Input value={value || ''} onChange={e => onChange(e.target.value)} className={error ? "border-destructive" : ""} />;
        }
    };

    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <Label className={cn("text-xs font-medium", error ? "text-destructive" : "text-foreground")}>
                    {input.label} {input.required && <span className="text-destructive">*</span>}
                </Label>
            </div>
            {renderInput()}
            {error && <p className="text-[10px] text-destructive font-medium">{error}</p>}
        </div>
    );
}
