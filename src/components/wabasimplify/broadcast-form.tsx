
'use client';

import { useFormStatus } from 'react-dom';
import { useActionState, useEffect, useRef, useState } from 'react';
import { handleStartBroadcast } from '@/app/actions/broadcast.actions';
import { TemplateInputRenderer } from './template-input-renderer';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { LoaderCircle, Send, AlertCircle, UploadCloud, Link as LinkIcon, Check, ChevronsUpDown, Download } from 'lucide-react';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import type { Project, Template, Tag, MetaFlow } from '@/lib/definitions';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';


const initialState = {
    message: undefined,
    error: undefined,
};

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending || disabled}>
            {pending ? (
                <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                </>
            ) : (
                <>
                    <Send className="mr-2 h-4 w-4" />
                    Start Broadcast
                </>
            )}
        </Button>
    );
}


const extractRequiredVariables = (template: WithId<Template>): string[] => {
    const variableIndices = new Set<number>();
    const regex = /{{(\d+)}}/g;

    const templateString = JSON.stringify(template);
    let match;
    while ((match = regex.exec(templateString)) !== null) {
        variableIndices.add(parseInt(match[1], 10));
    }

    return Array.from(variableIndices).sort((a, b) => a - b).map(i => `variable${i}`);
};

const validateFileContent = async (file: File, requiredVars: string[]): Promise<{ errors: string[], headers: string[] }> => {
    const errors: string[] = [];
    let rows: any[] = [];
    let headers: string[] = [];

    try {
        const buffer = await file.arrayBuffer();

        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            const text = new TextDecoder("utf-8").decode(buffer);
            const result = Papa.parse(text, { header: true, skipEmptyLines: true });
            rows = result.data;
            if (result.errors && result.errors.length > 0) {
                errors.push(`CSV Parse Error: ${result.errors[0].message}`);
                return { errors, headers };
            }
            if (result.meta.fields) {
                headers = result.meta.fields;
            }
        } else {
            const data = new Uint8Array(buffer);
            const workbook = xlsx.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

            if (rows.length > 0) {
                headers = (rows[0] as string[]).map(h => String(h));
                // Convert array of arrays to array of objects
                const headerRow = rows[0] as string[];
                rows = rows.slice(1).map((row: any) => {
                    const rowData: any = {};
                    headerRow.forEach((h: string, i: number) => {
                        rowData[h] = row[i];
                    });
                    return rowData;
                });
            }
        }

        if (rows.length === 0) {
            errors.push("The file is empty.");
            return { errors, headers };
        }

        // Validate Headers
        const lowerHeaders = headers.map(h => h.toLowerCase().trim());

        if (!lowerHeaders.includes('phone')) {
            errors.push("Missing required column: 'phone'");
        }

        const missingVars = requiredVars.filter(v => !lowerHeaders.includes(v.toLowerCase()));
        if (missingVars.length > 0) {
            errors.push(`Missing variable columns: ${missingVars.join(', ')}`);
        }

        // If headers are missing, stop here to avoid row spam
        if (errors.length > 0) return { errors, headers };

        // Validate Rows
        rows.forEach((row, index) => {
            if (errors.length >= 5) return; // Limit error count

            if (!row.phone && !row.Phone && !row.PHONE) {
                errors.push(`Row ${index + 2}: Missing phone number.`);
            }

            requiredVars.forEach(v => {
                // Case-insensitive lookup for the variable value
                const key = Object.keys(row).find(k => k.toLowerCase() === v.toLowerCase());
                const val = key ? row[key] : undefined;

                if (!val || String(val).trim() === '') {
                    errors.push(`Row ${index + 2}: Missing value for ${v}`);
                }
            });
        });

    } catch (e: any) {
        errors.push(`Failed to validate file: ${e.message}`);
    }

    return { errors, headers };
};
interface BroadcastFormProps {
    templates: WithId<Template>[];
    metaFlows: WithId<MetaFlow>[];
    onSuccess: () => void;
}

export function BroadcastForm({ templates, metaFlows, onSuccess }: BroadcastFormProps) {
    const { activeProject } = useProject();
    const [state, formAction] = useActionState(handleStartBroadcast, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [audienceType, setAudienceType] = useState<'file' | 'tags'>('file');
    const [broadcastType, setBroadcastType] = useState<'template' | 'flow'>('template');
    const [selectedTemplate, setSelectedTemplate] = useState<WithId<Template> | null>(null);
    const [selectedFlow, setSelectedFlow] = useState<WithId<MetaFlow> | null>(null);
    const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
    const [fileInputKey, setFileInputKey] = useState(Date.now());
    const [headerMediaSource, setHeaderMediaSource] = useState<'url' | 'file'>('url');
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

    // Validation State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isValidating, setIsValidating] = useState(false);

    // Variable Options for Autocomplete
    const [variableOptions, setVariableOptions] = useState<string[]>([]);

    useEffect(() => {
        const validateAndExtract = async () => {
            if (audienceType === 'tags') {
                // Default variables available for tagged contacts + custom fields
                setVariableOptions(['name', 'phone', 'email', 'custom_field_1', 'custom_field_2', 'custom_field_3']);
                setValidationErrors([]);
                return;
            }

            if (!selectedFile) {
                setValidationErrors([]);
                setVariableOptions([]);
                return;
            }

            let requiredVars: string[] = [];
            if (broadcastType === 'template' && selectedTemplate) {
                requiredVars = extractRequiredVariables(selectedTemplate);
            }

            setIsValidating(true);
            // Now validateFileContent returns { errors, headers }
            const { errors, headers } = await validateFileContent(selectedFile, requiredVars);

            setValidationErrors(errors);
            setVariableOptions(headers || []);
            setIsValidating(false);
        };

        validateAndExtract();
    }, [selectedFile, selectedTemplate, broadcastType, audienceType]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        } else {
            setSelectedFile(null);
            setValidationErrors([]);
            setVariableOptions([]);
        }
    };

    const handleDownloadSample = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "phone,name,variable1,variable2\n"
            + "919876543210,John Doe,your order,today\n"
            + "919876543211,Jane Smith,our latest offer,tomorrow";

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "sample_contacts.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Sample file downloading..." });
    };

    const handleTemplateChange = (templateId: string) => {
        const template = templates.find(t => t._id.toString() === templateId);
        setSelectedTemplate(template || null);
    };

    const handleFlowChange = (flowId: string) => {
        const flow = metaFlows.find(f => f._id.toString() === flowId);
        setSelectedFlow(flow || null);
    };

    const approvedTemplates = templates.filter(t => t.status?.toUpperCase() === 'APPROVED');

    return (
        <Card className="card-gradient card-gradient-green">
            <form ref={formRef} action={formAction}>
                <input type="hidden" name="projectId" value={activeProject?._id?.toString()} />
                <input type="hidden" name="broadcastType" value={broadcastType} />
                {selectedTagIds.map(id => <input key={id} type="hidden" name="tagIds" value={id} />)}
                <CardHeader>
                    <CardTitle>New Broadcast Campaign</CardTitle>
                    <CardDescription>Select a phone number, a message template, and your audience.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>1. Broadcast Type</Label>
                        <div className="flex items-center space-x-2 pt-1">
                            <RadioGroup defaultValue="template" onValueChange={(v) => setBroadcastType(v as 'template' | 'flow')}>
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="template" id="type-template" />
                                        <Label htmlFor="type-template">Message Template</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="flow" id="type-flow" />
                                        <Label htmlFor="type-flow">Interactive Flow</Label>
                                    </div>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phoneNumberId">2. Select Phone Number</Label>
                        <Select name="phoneNumberId" required value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                            <SelectTrigger id="phoneNumberId">
                                <SelectValue placeholder="Choose a number..." />
                            </SelectTrigger>
                            <SelectContent>
                                {(activeProject?.phoneNumbers || []).map((phone) => (
                                    <SelectItem key={phone.id} value={phone.id}>
                                        {phone.display_phone_number} ({phone.verified_name})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="contentId">3. Select Content</Label>
                        {broadcastType === 'template' ? (
                            <Select name="templateId" required={broadcastType === 'template'} value={selectedTemplate?._id.toString() || ''} onValueChange={handleTemplateChange}>
                                <SelectTrigger id="templateId"><SelectValue placeholder="Choose an approved template..." /></SelectTrigger>
                                <SelectContent>
                                    {approvedTemplates.length > 0 ? (
                                        approvedTemplates.map((template) => (
                                            <SelectItem key={template._id.toString()} value={template._id.toString()}>{template.name} (<span className="capitalize">{template.status ? template.status.replace(/_/g, " ").toLowerCase() : 'N/A'}</span>)</SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-sm text-muted-foreground">No approved templates found. <br /> Please sync with Meta or create a new one.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Select name="flowId" required={broadcastType === 'flow'} value={selectedFlow?._id.toString() || ''} onValueChange={handleFlowChange}>
                                <SelectTrigger id="flowId"><SelectValue placeholder="Choose a Flow..." /></SelectTrigger>
                                <SelectContent>
                                    {metaFlows.length > 0 ? (
                                        metaFlows.map((flow) => (
                                            <SelectItem key={flow._id.toString()} value={flow._id.toString()}>{flow.name}</SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-sm text-muted-foreground">No flows found. <br /> Please sync with Meta or create a new one.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {broadcastType === 'flow' && (
                        <div className="md:col-span-2 grid md:grid-cols-2 gap-4 border p-4 rounded-md bg-muted/20">
                            <div className="md:col-span-2 space-y-1">
                                <Label>Flow Message Configuration</Label>
                                <p className="text-xs text-muted-foreground">Define how the flow entry message looks to the user.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="flowHeader">Header (Optional)</Label>
                                <Input name="flowHeader" id="flowHeader" placeholder="Start your application" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="flowBody">Body Text (Required)</Label>
                                <Input name="flowBody" id="flowBody" placeholder="Click below to begin..." required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="flowFooter">Footer (Optional)</Label>
                                <Input name="flowFooter" id="flowFooter" placeholder="Wachat" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="flowCta">CTA Button (Required)</Label>
                                <Input name="flowCta" id="flowCta" placeholder="Open App" required />
                            </div>
                        </div>
                    )}

                    <div className="md:col-span-2 grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>4. Select Audience</Label>
                            <RadioGroup name="audienceType" value={audienceType} onValueChange={(val) => setAudienceType(val as any)} className="flex gap-4 pt-1">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="file" id="audience-file" /><Label htmlFor="audience-file">Upload File</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="tags" id="audience-tags" /><Label htmlFor="audience-tags">From Tags</Label></div>
                            </RadioGroup>
                        </div>
                        {audienceType === 'file' ? (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="csvFile">Upload Contacts</Label>
                                    <Button type="button" variant="link" size="sm" onClick={handleDownloadSample} className="p-0 h-auto">
                                        <Download className="mr-1 h-3 w-3" />
                                        Download Sample
                                    </Button>
                                </div>
                                <Input
                                    key={fileInputKey}
                                    id="csvFile"
                                    name="csvFile"
                                    type="file"
                                    accept=".csv,.xlsx"
                                    required
                                    onChange={handleFileChange}
                                    className="file:text-primary file:font-medium"
                                />
                                <p className="text-xs text-muted-foreground">
                                    For variables, use column names that match your template (e.g., 'variable1').
                                </p>
                                {isValidating && <p className="text-xs text-muted-foreground animate-pulse text-blue-500">Validating file...</p>}
                                {validationErrors.length > 0 && (
                                    <Alert variant="destructive" className="mt-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>File Error</AlertTitle>
                                        <AlertDescription>
                                            <ul className="list-disc pl-4 space-y-1">
                                                {validationErrors.slice(0, 5).map((err, i) => (
                                                    <li key={i}>{err}</li>
                                                ))}
                                                {validationErrors.length > 5 && <li>...and {validationErrors.length - 5} more issues.</li>}
                                            </ul>
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="contactTags">Select Contact Tags</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            <span className="truncate">
                                                {selectedTagIds.length > 0 ? `${selectedTagIds.length} tag(s) selected` : "Select tags..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Search tags..." />
                                            <CommandList>
                                                <CommandEmpty>No tags found.</CommandEmpty>
                                                <CommandGroup>
                                                    {(activeProject?.tags || []).map((tag: Tag) => (
                                                        <CommandItem
                                                            key={tag._id}
                                                            value={tag.name}
                                                            onSelect={() => {
                                                                const newSelected = selectedTagIds.includes(tag._id)
                                                                    ? selectedTagIds.filter(id => id !== tag._id)
                                                                    : [...selectedTagIds, tag._id];
                                                                setSelectedTagIds(newSelected);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", selectedTagIds.includes(tag._id) ? "opacity-100" : "opacity-0")} />
                                                            <Badge className="mr-2" style={{ backgroundColor: tag.color }}> </Badge>
                                                            <span>{tag.name}</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <p className="text-xs text-muted-foreground">
                                    Select one or more tags to send this broadcast to all contacts with those tags.
                                </p>
                            </div>
                        )}
                    </div>



                    {broadcastType === 'template' && selectedTemplate && (
                        <>
                            <div className="md:col-span-2">
                                <Separator className="my-2" />
                            </div>
                            <div className="md:col-span-2">
                                <TemplateInputRenderer template={selectedTemplate} variableOptions={variableOptions} />
                            </div>
                        </>
                    )}

                </CardContent>
                <CardFooter className="flex justify-end">
                    <SubmitButton disabled={!selectedPhoneNumber || (broadcastType === 'template' ? !selectedTemplate : !selectedFlow) || validationErrors.length > 0 || isValidating} />
                </CardFooter>
            </form>
        </Card >
    );
}
