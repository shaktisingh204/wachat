
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import type { FormField } from '@/lib/definitions';

interface CrmFormPreviewProps {
    settings: any;
}

export function CrmFormPreview({ settings }: CrmFormPreviewProps) {
    const title = settings.title || 'Form Title';
    const description = settings.description || 'Form description...';
    const fields: FormField[] = settings.fields || [];

    const uniqueId = React.useId().replace(/:/g, "");

    const dynamicStyles = `
      #preview-${uniqueId} {
        max-width: ${settings.formWidth || 480}px;
        margin-left: auto;
        margin-right: auto;
      }
      #preview-${uniqueId} .form-field-preview {
        color: ${settings.fieldColor};
        background-color: ${settings.fieldBgColor};
        border-color: ${settings.fieldBorderColor};
        border-radius: ${settings.fieldBorderRadius}px;
        padding: ${settings.fieldPadding}px;
        font-family: ${settings.fieldTypography?.fontFamily};
        border-width: ${settings.fieldBorderWidth || 1}px;
        border-style: ${settings.fieldBorderType || 'solid'};
      }
       #preview-${uniqueId} .submit-button-preview {
        color: ${settings.buttonColor};
        background-color: ${settings.buttonBgColor};
        font-family: ${settings.buttonTypography?.fontFamily};
        border-radius: ${settings.buttonBorderRadius}px;
        padding: ${settings.buttonPadding}px;
        border-style: ${settings.buttonBorderType || 'none'};
      }
    `;

    // @ts-ignore
    const SubmitIcon = settings.buttonIcon ? LucideIcons[settings.buttonIcon] : null;

    return (
        <Card className="shadow-md w-full" id={`preview-${uniqueId}`}>
            <style>{dynamicStyles}</style>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-12" style={{gap: `${settings.fieldSpacing || 24}px`}}>
                {fields.map(field => {
                    const widthClasses: { [key: string]: string } = { '100%': 'col-span-12', '50%': 'col-span-12 sm:col-span-6', '33.33%': 'col-span-12 sm:col-span-4', '25%': 'col-span-12 sm:col-span-3' };
                    const sizeClasses = { sm: 'h-8 text-xs', md: 'h-10 text-sm', lg: 'h-12 text-base'}[field.size || 'md'];
                    
                    if (field.type === 'hidden') return null;

                    const fieldContent = () => {
                        const commonProps = { id: `preview-${field.id}`, placeholder: field.placeholder, className: cn('form-field-preview', sizeClasses), disabled: true };
                        const fieldOptions = (field.options || '').split('\n').map(o => o.trim());

                        switch(field.type) {
                            case 'textarea': return <Textarea {...commonProps} />;
                            case 'select': return <Select><SelectTrigger className={cn('form-field-preview', sizeClasses)}><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger><SelectContent>{fieldOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select>;
                            case 'checkbox': return <div className="flex items-center gap-2 pt-2"><Checkbox id={`preview-${field.id}`} disabled /><Label htmlFor={`preview-${field.id}`} className="font-normal">{field.label}</Label></div>;
                            case 'acceptance': return <div className="flex items-center gap-2 pt-2"><Checkbox id={`preview-${field.id}`} disabled /><Label htmlFor={`preview-${field.id}`} className="font-normal">{field.defaultValue || 'I agree to the terms.'}</Label></div>;
                            case 'radio': return <RadioGroup defaultValue={field.defaultValue} className="flex flex-col gap-2 pt-2">{fieldOptions.map(opt => <div key={opt} className="flex items-center space-x-2"><RadioGroupItem value={opt} id={`preview-${field.id}-${opt}`} disabled /><Label htmlFor={`preview-${field.id}-${opt}`} className="font-normal">{opt}</Label></div>)}</RadioGroup>
                            case 'file': return <Input {...commonProps} type="file" />;
                            default: return <Input {...commonProps} type={field.type} />;
                        }
                    };

                    return (
                        <div key={field.id} className={cn("space-y-2", widthClasses[field.columnWidth || '100%'], field.labelPosition === 'inline' && 'flex items-center gap-4')}>
                            {field.labelPosition !== 'hidden' && <Label htmlFor={`preview-${field.id}`} className={cn(field.labelPosition === 'inline' && 'flex-shrink-0', field.type === 'checkbox' && 'hidden')}>{field.label}</Label>}
                            <div className="w-full">
                                {fieldContent()}
                                {field.description && <p className="text-xs pt-1 text-muted-foreground">{field.description}</p>}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
            <CardFooter style={{justifyContent: settings.buttonAlign || 'flex-start'}}>
                <Button disabled className="w-full submit-button-preview" size={settings.buttonSize}>
                    {SubmitIcon && settings.buttonIconPosition === 'left' && <SubmitIcon className="mr-2 h-4 w-4" style={{marginRight: `${settings.buttonIconSpacing || 8}px`}}/>}
                    {settings.submitButtonText || 'Submit'}
                    {SubmitIcon && settings.buttonIconPosition === 'right' && <SubmitIcon className="ml-2 h-4 w-4" style={{marginLeft: `${settings.buttonIconSpacing || 8}px`}}/>}
                </Button>
            </CardFooter>
        </Card>
    );
}
