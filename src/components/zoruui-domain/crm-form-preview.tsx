'use client';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
import React from 'react';
import Image from 'next/image';

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

    const [formValues, setFormValues] = React.useState<Record<string, string>>({});

    const handleValueChange = (id: string, value: string) => {
        setFormValues(prev => ({ ...prev, [id]: value }));
    };

    const isFieldVisible = (field: FormField) => {
        if (field.type === 'hidden') return false;
        if (!field.validation?.showIf) return true;
        const condition = field.validation.showIf;
        const targetValue = formValues[condition.fieldId || ''] || '';
        if (condition.operator === 'isFilled') return targetValue.trim().length > 0;
        if (condition.operator === 'equals') return targetValue === condition.value;
        if (condition.operator === 'notEquals') return targetValue !== condition.value;
        return true;
    };

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
            <div className="flex flex-col items-center text-center p-6 pb-4 gap-1.5">
                 {settings.logoUrl && <Image src={settings.logoUrl} alt="Logo" width={80} height={80} className="object-contain" />}
                <h3 className="text-lg font-semibold text-zoru-ink">{title}</h3>
                <p className="text-sm text-zoru-ink-muted">{description}</p>
            </div>
            <div className="px-6 pb-4 grid grid-cols-12" style={{gap: `${settings.fieldSpacing || 24}px`}}>
                {fields.map(field => {
                    const widthClasses: { [key: string]: string } = { '100%': 'col-span-12', '50%': 'col-span-12 sm:col-span-6', '33.33%': 'col-span-12 sm:col-span-4', '25%': 'col-span-12 sm:col-span-3' };
                    const sizeClasses = { sm: 'h-8 text-xs', md: 'h-10 text-sm', lg: 'h-12 text-base'}[field.size || 'md'];

                    if (!isFieldVisible(field)) return null;

                    const fieldContent = () => {
                        const commonProps = { 
                            id: `preview-${field.id}`, 
                            placeholder: field.placeholder, 
                            className: cn('form-field-preview', sizeClasses),
                            value: formValues[field.fieldId || field.id] || '',
                            onChange: (e: any) => handleValueChange(field.fieldId || field.id, e.target.value)
                        };
                        const fieldOptions = (field.options || '').split('\n').map(o => o.trim());

                        switch(field.type) {
                            case 'textarea': return <Textarea {...commonProps} />;
                            case 'select': return <Select value={formValues[field.fieldId || field.id] || ''} onValueChange={v => handleValueChange(field.fieldId || field.id, v)}><ZoruSelectTrigger className={cn('form-field-preview', sizeClasses)}><ZoruSelectValue placeholder={field.placeholder || "Select..."} /></ZoruSelectTrigger><ZoruSelectContent>{fieldOptions.map(opt => <ZoruSelectItem key={opt} value={opt}>{opt}</ZoruSelectItem>)}</ZoruSelectContent></Select>;
                            case 'checkbox': return <div className="flex items-center gap-2 pt-2"><Checkbox id={`preview-${field.id}`} checked={formValues[field.fieldId || field.id] === 'true'} onCheckedChange={(c) => handleValueChange(field.fieldId || field.id, c ? 'true' : '')} /><Label htmlFor={`preview-${field.id}`} className="font-normal">{field.label}</Label></div>;
                            case 'acceptance': return <div className="flex items-center gap-2 pt-2"><Checkbox id={`preview-${field.id}`} checked={formValues[field.fieldId || field.id] === 'true'} onCheckedChange={(c) => handleValueChange(field.fieldId || field.id, c ? 'true' : '')} /><Label htmlFor={`preview-${field.id}`} className="font-normal">{field.defaultValue || 'I agree to the terms.'}</Label></div>;
                            case 'radio': return <RadioGroup value={formValues[field.fieldId || field.id] || field.defaultValue || ''} onValueChange={(v) => handleValueChange(field.fieldId || field.id, v)} className="flex flex-col gap-2 pt-2">{fieldOptions.map(opt => <div key={opt} className="flex items-center space-x-2"><ZoruRadioGroupItem value={opt} id={`preview-${field.id}-${opt}`} /><Label htmlFor={`preview-${field.id}-${opt}`} className="font-normal">{opt}</Label></div>)}</RadioGroup>
                            case 'file': return <Input id={`preview-${field.id}`} className={cn('form-field-preview', sizeClasses)} type="file" />;
                            case 'phone': return <Input {...commonProps} type="tel" placeholder={field.placeholder || '+1 555 123 4567'} />;
                            case 'address': return (
                                <div className="grid grid-cols-2 gap-2">
                                    <Input className={cn('col-span-2 form-field-preview', sizeClasses)} placeholder="Address line 1" />
                                    <Input className={cn('col-span-2 form-field-preview', sizeClasses)} placeholder="Address line 2" />
                                    <Input className={cn('form-field-preview', sizeClasses)} placeholder="City" />
                                    <Input className={cn('form-field-preview', sizeClasses)} placeholder="State" />
                                    <Input className={cn('form-field-preview', sizeClasses)} placeholder="ZIP" />
                                    <Input className={cn('form-field-preview', sizeClasses)} placeholder="Country" />
                                </div>
                            );
                            case 'rating': return (
                                <div className="flex items-center gap-1" aria-label="Star rating preview">
                                    {Array.from({ length: field.maxRating || 5 }).map((_, i) => (
                                        <LucideIcons.Star key={i} className="h-5 w-5 text-zoru-ink-muted" />
                                    ))}
                                </div>
                            );
                            case 'signature': return <Input {...commonProps} placeholder={field.placeholder || 'Type your name as signature'} />;
                            default: return <Input {...commonProps} type={field.type} />;
                        }
                    };

                    return (
                        <div key={field.id} className={cn("space-y-2", widthClasses[field.columnWidth || '100%'], field.labelPosition === 'inline' && 'flex items-center gap-4')}>
                            {field.labelPosition !== 'hidden' && <Label htmlFor={`preview-${field.id}`} className={cn('text-zoru-ink', field.labelPosition === 'inline' && 'flex-shrink-0', field.type === 'checkbox' && 'hidden')}>{field.label}</Label>}
                            <div className="w-full">
                                {fieldContent()}
                                {field.description && <p className="text-xs pt-1 text-zoru-ink-muted">{field.description}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex p-6 pt-0" style={{flexDirection: 'column', justifyContent: settings.buttonAlign || 'flex-start', alignItems: settings.buttonAlign === 'center' ? 'center' : settings.buttonAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                <Button disabled className="w-full submit-button-preview" size={settings.buttonSize}>
                    {SubmitIcon && settings.buttonIconPosition === 'left' && <SubmitIcon className="mr-2 h-4 w-4" style={{marginRight: `${settings.buttonIconSpacing || 8}px`}}/>}
                    {settings.submitButtonText || 'Submit'}
                    {SubmitIcon && settings.buttonIconPosition === 'right' && <SubmitIcon className="ml-2 h-4 w-4" style={{marginLeft: `${settings.buttonIconSpacing || 8}px`}}/>}
                </Button>
                {settings.footerText && <p className="text-xs text-zoru-ink-muted text-center pt-2" dangerouslySetInnerHTML={{ __html: settings.footerText }}></p>}
            </div>
        </Card>
    );
}
