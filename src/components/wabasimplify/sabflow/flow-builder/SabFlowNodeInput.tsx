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
                    <Select value={value || undefined} onValueChange={onChange}>
                        <SelectTrigger className={error ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                            {input.options?.map((opt: any) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            case 'project-selector': {
                let projectOptions = dataOptions.projects;
                let connectUrl = '/dashboard';

                if (input.appType === 'facebook') {
                    projectOptions = dataOptions.facebookProjects;
                    connectUrl = '/dashboard/facebook/all-projects';
                } else if (input.appType === 'wachat') {
                    projectOptions = dataOptions.wachatProjects;
                    connectUrl = '/dashboard/settings';
                }

                const isEmpty = !projectOptions || projectOptions.length === 0;

                return (
                    <div className="space-y-2">
                        <SabFlowCombobox
                            value={value || ""}
                            onChange={onChange}
                            options={projectOptions || []}
                            placeholder="Select Project"
                            searchPlaceholder="Search projects..."
                            emptyText="No projects found"
                            error={!!error}
                        />
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
            }
            case 'template-selector': {
                const templateOptions = dataOptions.templates || [];
                return (
                    <SabFlowCombobox
                        value={value || ""}
                        onChange={onChange}
                        options={templateOptions}
                        placeholder="Select Template"
                        searchPlaceholder="Search templates..."
                        emptyText="No templates found for this project"
                        error={!!error}
                    />
                );
            }
            case 'tag-selector': {
                const tagOptions = dataOptions.tags || [];
                return (
                    <SabFlowCombobox
                        value={value || ""}
                        onChange={onChange}
                        options={tagOptions}
                        placeholder="Select Tag"
                        searchPlaceholder="Search tags..."
                        emptyText="No tags found"
                        error={!!error}
                    />
                );
            }
            case 'dynamic-selector': {
                // Keep fallback for other dynamic types if any, using DynamicSelector if available or Select
                if (dataOptions[input.fetch]) {
                    return (
                        <SabFlowCombobox
                            value={value || ""}
                            onChange={onChange}
                            options={dataOptions[input.fetch]}
                            placeholder={`Select ${input.label}`}
                            searchPlaceholder={`Search ${input.label}...`}
                            error={!!error}
                        />
                    )
                }
                return <div className="text-sm text-muted-foreground">Dynamic Selector: {input.fetch} (Data not loaded)</div>;
            }
            default:
                return <Input value={value || ''} onChange={e => onChange(e.target.value)} className={error ? "border-destructive" : ""} />;
        }
    };

    return (
        <div className="space-y-1.5 nodrag">
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
