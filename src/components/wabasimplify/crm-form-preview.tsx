'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruLabel,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
} from '@/components/zoruui';
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
        <ZoruCard className="shadow-md w-full" id={`preview-${uniqueId}`}>
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

                    if (field.type === 'hidden') return null;

                    const fieldContent = () => {
                        const commonProps = { id: `preview-${field.id}`, placeholder: field.placeholder, className: cn('form-field-preview', sizeClasses), disabled: true };
                        const fieldOptions = (field.options || '').split('\n').map(o => o.trim());

                        switch(field.type) {
                            case 'textarea': return <ZoruTextarea {...commonProps} />;
                            case 'select': return <ZoruSelect><ZoruSelectTrigger className={cn('form-field-preview', sizeClasses)}><ZoruSelectValue placeholder={field.placeholder || "Select..."} /></ZoruSelectTrigger><ZoruSelectContent>{fieldOptions.map(opt => <ZoruSelectItem key={opt} value={opt}>{opt}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect>;
                            case 'checkbox': return <div className="flex items-center gap-2 pt-2"><ZoruCheckbox id={`preview-${field.id}`} disabled /><ZoruLabel htmlFor={`preview-${field.id}`} className="font-normal">{field.label}</ZoruLabel></div>;
                            case 'acceptance': return <div className="flex items-center gap-2 pt-2"><ZoruCheckbox id={`preview-${field.id}`} disabled /><ZoruLabel htmlFor={`preview-${field.id}`} className="font-normal">{field.defaultValue || 'I agree to the terms.'}</ZoruLabel></div>;
                            case 'radio': return <ZoruRadioGroup defaultValue={field.defaultValue} className="flex flex-col gap-2 pt-2">{fieldOptions.map(opt => <div key={opt} className="flex items-center space-x-2"><ZoruRadioGroupItem value={opt} id={`preview-${field.id}-${opt}`} disabled /><ZoruLabel htmlFor={`preview-${field.id}-${opt}`} className="font-normal">{opt}</ZoruLabel></div>)}</ZoruRadioGroup>
                            case 'file': return <ZoruInput {...commonProps} type="file" />;
                            case 'phone': return <ZoruInput {...commonProps} type="tel" placeholder={field.placeholder || '+1 555 123 4567'} />;
                            case 'address': return (
                                <div className="grid grid-cols-2 gap-2">
                                    <ZoruInput className={cn('col-span-2 form-field-preview', sizeClasses)} placeholder="Address line 1" disabled />
                                    <ZoruInput className={cn('col-span-2 form-field-preview', sizeClasses)} placeholder="Address line 2" disabled />
                                    <ZoruInput className={cn('form-field-preview', sizeClasses)} placeholder="City" disabled />
                                    <ZoruInput className={cn('form-field-preview', sizeClasses)} placeholder="State" disabled />
                                    <ZoruInput className={cn('form-field-preview', sizeClasses)} placeholder="ZIP" disabled />
                                    <ZoruInput className={cn('form-field-preview', sizeClasses)} placeholder="Country" disabled />
                                </div>
                            );
                            case 'rating': return (
                                <div className="flex items-center gap-1" aria-label="Star rating preview">
                                    {Array.from({ length: field.maxRating || 5 }).map((_, i) => (
                                        <LucideIcons.Star key={i} className="h-5 w-5 text-muted-foreground" />
                                    ))}
                                </div>
                            );
                            case 'signature': return <ZoruInput {...commonProps} placeholder={field.placeholder || 'Type your name as signature'} />;
                            default: return <ZoruInput {...commonProps} type={field.type} />;
                        }
                    };

                    return (
                        <div key={field.id} className={cn("space-y-2", widthClasses[field.columnWidth || '100%'], field.labelPosition === 'inline' && 'flex items-center gap-4')}>
                            {field.labelPosition !== 'hidden' && <ZoruLabel htmlFor={`preview-${field.id}`} className={cn('text-zoru-ink', field.labelPosition === 'inline' && 'flex-shrink-0', field.type === 'checkbox' && 'hidden')}>{field.label}</ZoruLabel>}
                            <div className="w-full">
                                {fieldContent()}
                                {field.description && <p className="text-xs pt-1 text-zoru-ink-muted">{field.description}</p>}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex p-6 pt-0" style={{flexDirection: 'column', justifyContent: settings.buttonAlign || 'flex-start', alignItems: settings.buttonAlign === 'center' ? 'center' : settings.buttonAlign === 'right' ? 'flex-end' : 'flex-start' }}>
                <ZoruButton disabled className="w-full submit-button-preview" size={settings.buttonSize}>
                    {SubmitIcon && settings.buttonIconPosition === 'left' && <SubmitIcon className="mr-2 h-4 w-4" style={{marginRight: `${settings.buttonIconSpacing || 8}px`}}/>}
                    {settings.submitButtonText || 'Submit'}
                    {SubmitIcon && settings.buttonIconPosition === 'right' && <SubmitIcon className="ml-2 h-4 w-4" style={{marginLeft: `${settings.buttonIconSpacing || 8}px`}}/>}
                </ZoruButton>
                {settings.footerText && <p className="text-xs text-zoru-ink-muted text-center pt-2" dangerouslySetInnerHTML={{ __html: settings.footerText }}></p>}
            </div>
        </ZoruCard>
    );
}
