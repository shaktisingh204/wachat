'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UploadCloud, Link as LinkIcon, MapPin, ChevronsUpDown, Check } from 'lucide-react';
import type { WithId } from 'mongodb';
import type { Template } from '@/lib/definitions';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

interface SmartVariableInputProps {
    id: string;
    name: string;
    placeholder?: string;
    required?: boolean;
    variableOptions?: string[]; // List of available variables (e.g., from CSV headers or contact fields)
    value?: string;
    onChange?: (value: string) => void;
}

function SmartVariableInput({ id, name, placeholder, required, variableOptions = [], value, onChange }: SmartVariableInputProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');

    const handleSelect = (currentValue: string) => {
        // When selecting a variable, wrap it in {{ }}
        const newValue = `{{${currentValue}}}`;
        setInputValue(newValue);
        if (onChange) onChange(newValue);
        setOpen(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (onChange) onChange(e.target.value);
    };

    return (
        <div className="relative">
            <div className="flex gap-2">
                <Input
                    id={id}
                    name={name}
                    placeholder={placeholder}
                    required={required}
                    value={inputValue}
                    onChange={handleChange}
                    className="flex-1"
                />
                {variableOptions.length > 0 && (
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-[40px] px-0 flex-shrink-0"
                                type="button"
                                title="Select Variable"
                            >
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                <span className="sr-only">Select Variable</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="end">
                            <Command>
                                <CommandInput placeholder="Search variable..." />
                                <CommandList>
                                    <CommandEmpty>No variable found.</CommandEmpty>
                                    <CommandGroup heading="Variables">
                                        {variableOptions.map((variable) => (
                                            <CommandItem
                                                key={variable}
                                                value={variable}
                                                onSelect={() => handleSelect(variable)}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        inputValue === `{{${variable}}}` ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {variable}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
            {variableOptions.length > 0 && <p className="text-[10px] text-muted-foreground mt-1">Type manually or select a variable.</p>}
        </div>
    );
}

interface TemplateInputRendererProps {
    template: WithId<Template>;
    variableOptions?: string[];
}

export function TemplateInputRenderer({ template, variableOptions = [] }: TemplateInputRendererProps) {
    const [headerMediaSource, setHeaderMediaSource] = useState<'url' | 'file'>('file');

    const components = template.components || [];

    // --- HELPER to extract variables from text ---
    const getVariables = (text: string | undefined): number[] => {
        if (!text) return [];
        const matches = text.match(/{{\s*(\d+)\s*}}/g);
        return matches ? [...new Set(matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, ''))))].sort((a, b) => a - b) : [];
    };

    return (
        <div className="space-y-6">
            {/* --- HEADER --- */}
            {components.map((component, idx) => {
                if (component.type === 'HEADER') {
                    // Check for TEXT format explicit or implicit (missing format usually implies TEXT if type is HEADER and text is present)
                    if (component.format === 'TEXT' || (!component.format && component.text)) {
                        const vars = getVariables(component.text);
                        if (vars.length > 0) {
                            return (
                                <div key={`header-${idx}`} className="space-y-2">
                                    <Label className="font-semibold">Header Variables</Label>
                                    {vars.map(v => (
                                        <div key={`header-var-${v}`} className="space-y-1">
                                            <Label htmlFor={`variable_header_${v}`} className="text-xs text-muted-foreground">Variable {'{{'}{v}{'}}'}</Label>
                                            <SmartVariableInput
                                                id={`variable_header_${v}`}
                                                name={`variable_header_${v}`}
                                                placeholder={`Value for {{${v}}}`}
                                                required
                                                variableOptions={variableOptions}
                                            />
                                        </div>
                                    ))}
                                </div>
                            );
                        }
                    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format || '')) {
                        return (
                            <div key={`header-${idx}`} className="space-y-3 p-3 border rounded-md bg-muted/10">
                                <Label className="font-semibold">Header Media ({component.format})</Label>
                                <RadioGroup value={headerMediaSource} onValueChange={(v) => setHeaderMediaSource(v as 'url' | 'file')} className="flex gap-4">
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="file" id="h-source-file" /><Label htmlFor="h-source-file" className="font-normal flex items-center gap-1 cursor-pointer"><UploadCloud className="h-4 w-4" /> Upload</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="url" id="h-source-url" /><Label htmlFor="h-source-url" className="font-normal flex items-center gap-1 cursor-pointer"><LinkIcon className="h-4 w-4" /> URL</Label></div>
                                </RadioGroup>

                                {headerMediaSource === 'file' ? (
                                    <div className="space-y-1">
                                        <input type="hidden" name="mediaSource" value="file" />
                                        <Input
                                            name="headerMediaFile"
                                            type="file"
                                            accept={component.format === 'IMAGE' ? "image/*" : component.format === 'VIDEO' ? "video/*" : "application/pdf"}
                                            required
                                            className="file:text-primary file:font-medium"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Supports {component.format === 'IMAGE' ? 'JPG, PNG' : component.format === 'VIDEO' ? 'MP4' : 'PDF'}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <input type="hidden" name="mediaSource" value="url" />
                                        <Input name="headerMediaUrl" type="url" placeholder={`https://example.com/${component.format?.toLowerCase()}`} required />
                                    </div>
                                )}
                            </div>
                        );
                    } else if (component.format === 'LOCATION') {
                        return (
                            <div key={`header-${idx}`} className="space-y-3 p-3 border rounded-md bg-muted/10">
                                <Label className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Location Header</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="location_lat" className="text-xs">Latitude</Label>
                                        <Input name="location_lat" id="location_lat" placeholder="25.2048" required step="any" type="number" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="location_long" className="text-xs">Longitude</Label>
                                        <Input name="location_long" id="location_long" placeholder="55.2708" required step="any" type="number" />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label htmlFor="location_name" className="text-xs">Location Name</Label>
                                        <Input name="location_name" id="location_name" placeholder="Burj Khalifa" required />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label htmlFor="location_address" className="text-xs">Address</Label>
                                        <Input name="location_address" id="location_address" placeholder="1 Sheikh Mohammed bin Rashid Blvd - Dubai" required />
                                    </div>
                                </div>
                            </div>
                        );
                    }
                }
                return null;
            })}

            {/* --- BODY --- */}
            {(() => {
                const bodyComp = components.find(c => c.type === 'BODY');
                const bodyText = bodyComp?.text || template.body;
                const vars = getVariables(bodyText);

                if (vars.length === 0) return null;

                return (
                    <div className="space-y-3">
                        <Label className="font-semibold">Body Variables</Label>
                        <div className="grid gap-3">
                            {vars.map(v => (
                                <div key={`body-var-${v}`} className="space-y-1">
                                    <Label htmlFor={`variable_body_${v}`} className="text-xs text-muted-foreground">Variable {'{{'}{v}{'}}'}</Label>
                                    <SmartVariableInput
                                        id={`variable_body_${v}`}
                                        name={`variable_body_${v}`}
                                        placeholder={`Val for {{${v}}}`}
                                        required
                                        variableOptions={variableOptions}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* --- BUTTONS --- */}
            {(() => {
                const buttonsComp = components.find(c => c.type === 'BUTTONS');
                if (!buttonsComp || !buttonsComp.buttons) return null;

                // Check specifically for COPY_CODE or URL (dynamic)
                const interactiveButtons = buttonsComp.buttons.map((btn: any, idx: number) => ({ ...btn, index: idx })).filter((btn: any) =>
                    btn.type === 'COPY_CODE' || (btn.type === 'URL' && btn.url?.includes('{{1}}'))
                );

                if (interactiveButtons.length === 0) return null;

                return (
                    <div className="space-y-3 pt-2">
                        <Label className="font-semibold">Button Parameters</Label>
                        <div className="grid gap-3">
                            {interactiveButtons.map((btn: any) => (
                                <div key={`btn-${btn.index}`} className="space-y-1">
                                    <Label htmlFor={`variable_button_${btn.index}`} className="text-xs text-muted-foreground">
                                        {btn.type === 'COPY_CODE' ? `Coupon Code (Button: ${btn.text})` : `URL Suffix (Button: ${btn.text})`}
                                    </Label>
                                    <SmartVariableInput
                                        id={`variable_button_${btn.index}`}
                                        name={`variable_button_${btn.index}`}
                                        placeholder={btn.type === 'COPY_CODE' ? "SUMMER20" : "promo/123"}
                                        required
                                        variableOptions={variableOptions}
                                    />
                                    {btn.type === 'URL' && <p className="text-[10px] text-muted-foreground">Appended to: {btn.url.split('{{1}}')[0]}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* --- CAROUSEL --- */}
            {template.type === 'MARKETING_CAROUSEL' && (
                <div className="space-y-4 border-t pt-4">
                    <h3 className="font-semibold text-sm">Carousel Cards Media</h3>
                    <p className="text-xs text-muted-foreground">Upload media for each card.</p>

                    <div className="grid gap-4">
                        {template.components?.find(c => c.type === 'CAROUSEL')?.cards?.map((card: any, index: number) => {
                            const header = card.components?.find((c: any) => c.type === 'HEADER');
                            if (!header || !['IMAGE', 'VIDEO'].includes(header.format)) return null;

                            return (
                                <div key={index} className="p-4 border rounded-md bg-muted/20 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <Label className="font-medium">Card {index + 1} ({header.format})</Label>
                                    </div>
                                    <Input
                                        name={`card_${index}_media_file`}
                                        type="file"
                                        accept={header.format === 'IMAGE' ? "image/*" : "video/*"}
                                        required
                                        className="file:text-primary file:font-medium"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
