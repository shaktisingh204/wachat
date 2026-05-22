'use client';

import {
  Button,
  Input,
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Checkbox,
  Label,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  RadioGroup,
  ZoruRadioGroupItem,
} from '@/components/zoruui';
import {
  useForm,
  Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCart } from '@/context/cart-context';
import { useState, useMemo, useTransition } from 'react';
import { LoaderCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { FormField } from '@/lib/definitions';

interface FormBlockRendererProps {
  settings: any;
}

export const FormBlockRenderer: React.FC<FormBlockRendererProps> = ({ settings }) => {
    const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isPending, startTransition] = useTransition();

    const validationSchema = useMemo(() => {
        const schemaObject: { [key: string]: z.ZodType<any, any> } = {};
        (settings.fields || []).forEach((field: FormField) => {
            if (field.type === 'hidden' || field.type === 'html') return;
            const fieldName = field.fieldId || field.id;
            let fieldSchema: z.ZodType<any, any>;

            switch(field.type) {
                case 'email': fieldSchema = z.string().email({ message: "Invalid email address" }); break;
                case 'url': fieldSchema = z.string().url({ message: "Invalid URL" }); break;
                case 'number': fieldSchema = z.string().refine(val => !val || !isNaN(Number(val)), { message: "Must be a number" }); break;
                case 'checkbox':
                    fieldSchema = z.boolean();
                    if(field.required) fieldSchema = fieldSchema.refine(val => val === true, { message: `${field.label} is required` });
                    break;
                case 'acceptance':
                    fieldSchema = z.boolean().refine(val => val === true, { message: `You must accept the terms.` });
                    break;
                case 'select':
                    if (field.multiple) fieldSchema = z.array(z.string()).nonempty({ message: `${field.label} is required` });
                    else fieldSchema = z.string();
                    break;
                default: fieldSchema = z.string();
            }

            if (field.required && !['checkbox', 'acceptance', 'select'].includes(field.type)) {
                 if (fieldSchema instanceof z.ZodString) {
                    fieldSchema = fieldSchema.min(1, { message: `${field.label} is required` });
                }
            } else if (!field.required) {
                 fieldSchema = fieldSchema.optional();
            }

            schemaObject[fieldName] = fieldSchema;
        });
        return z.object(schemaObject);
    }, [settings.fields]);

    const form = useForm<z.infer<typeof validationSchema>>({
        resolver: zodResolver(validationSchema),
        defaultValues: (settings.fields || []).reduce((acc: any, field: FormField) => {
            const fieldName = field.fieldId || field.id;
            acc[fieldName] = field.defaultValue || (field.type === 'checkbox' || field.type === 'acceptance' ? false : (field.multiple ? [] : ''));
            return acc;
        }, {})
    });

    const { control, handleSubmit, formState: { errors } } = form;

    async function onSubmit(data: any) {
        startTransition(async () => {
            setSubmissionStatus('submitting');
            setErrorMessage('');
            
            try {
                if (settings.webhookUrl) {
                    const response = await fetch(settings.webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    if (!response.ok) throw new Error(`Submission failed with status: ${response.status}`);
                }
                setSuccessMessage(settings.successMessage || 'Thank you! Your submission has been received.');
                if (settings.redirectUrl) window.location.href = settings.redirectUrl;
            } catch (error: any) {
                setSubmissionStatus('error');
                setErrorMessage(error.message || "An unknown error occurred.");
            }
        });
    }
    
    if (successMessage) {
        return <div className="p-8 text-center border-2 border-dashed rounded-lg text-green-600 border-green-200 bg-green-50"><CheckCircle className="mx-auto h-12 w-12" /><h3 className="mt-4 text-lg font-semibold">{successMessage}</h3></div>;
    }

    const descriptionStyle: React.CSSProperties = {
        color: settings.descriptionColor,
        fontFamily: settings.descriptionTypography?.fontFamily,
    };

    const uniqueId = React.useId().replace(/:/g, "");
    
    const dynamicStyles = `
      #form-${uniqueId} .form-field {
        color: ${settings.fieldColor};
        background-color: ${settings.fieldBgColor};
        border-color: ${settings.fieldBorderColor};
        border-radius: ${settings.fieldBorderRadius}px;
        padding: ${settings.fieldPadding}px;
        font-family: ${settings.fieldTypography?.fontFamily};
        border-width: ${settings.fieldBorderWidth || 1}px;
        border-style: ${settings.fieldBorderType || 'solid'};
      }
      #form-${uniqueId} .form-field:focus {
        border-color: ${settings.fieldFocusBorderColor || 'hsl(var(--primary))'} !important;
        box-shadow: 0 0 0 1px ${settings.fieldFocusBorderColor || 'hsl(var(--primary))'} !important;
      }
      #form-${uniqueId} .submit-button {
        color: ${settings.buttonColor};
        background-color: ${settings.buttonBgColor};
        font-family: ${settings.buttonTypography?.fontFamily};
        border-radius: ${settings.buttonBorderRadius}px;
        padding: ${settings.buttonPadding}px;
        border-style: ${settings.buttonBorderType || 'none'};
        box-shadow: ${settings.buttonBoxShadow === 'none' ? 'none' : 'var(--tw-shadow)'};
      }
      #form-${uniqueId} .submit-button:hover {
        color: ${settings.buttonHoverColor};
        background-color: ${settings.buttonHoverBgColor};
      }
    `;

    // @ts-ignore
    const SubmitIcon = settings.buttonIcon ? LucideIcons[settings.buttonIcon] : null;

    return (
        <ZoruCard className="mx-auto" id={`form-${uniqueId}`}>
            <style>{dynamicStyles}</style>
            <form onSubmit={handleSubmit(onSubmit)}>
                <ZoruCardHeader>
                    <ZoruCardTitle>{settings.title || 'Contact Form'}</ZoruCardTitle>
                    {settings.description && <ZoruCardDescription>{settings.description}</ZoruCardDescription>}
                </ZoruCardHeader>
                <ZoruCardContent className="grid grid-cols-12" style={{gap: `${settings.fieldSpacing || 24}px`}}>
                    {(settings.fields || []).map((field: FormField) => {
                        const widthClasses: { [key: string]: string } = { '100%': 'col-span-12', '50%': 'col-span-12 md:col-span-6', '33.33%': 'col-span-12 md:col-span-4', '25%': 'col-span-12 md:col-span-3' };
                        const sizeClasses = { sm: 'h-8 text-xs', md: 'h-10 text-sm', lg: 'h-12 text-base'}[field.size || 'md'];

                        if (field.type === 'html') return <div key={field.id} className={widthClasses[field.columnWidth || '100%']} dangerouslySetInnerHTML={{ __html: field.htmlContent || '' }} />;
                        if (field.type === 'hidden') return <Controller key={field.id} name={field.fieldId || field.id} control={control} render={({ field: controllerField }) => <input type="hidden" {...controllerField} />} />;
                        
                        const fieldName = field.fieldId || field.id;

                        return (
                            <div key={field.id} className={cn("space-y-2", widthClasses[field.columnWidth || '100%'], field.labelPosition === 'inline' && 'flex items-center gap-4')}>
                                {field.labelPosition !== 'hidden' && <ZoruLabel htmlFor={fieldName} style={{color: settings.labelColor, fontFamily: settings.labelTypography?.fontFamily, marginBottom: field.labelPosition !== 'inline' ? `${settings.labelSpacing || 8}px` : '0'}} className={cn(field.labelPosition === 'inline' && 'flex-shrink-0')}>{field.label} {field.required && '*'}</ZoruLabel>}
                                <div className="w-full">
                                    <Controller
                                        name={fieldName}
                                        control={control}
                                        render={({ field: controllerField }) => {
                                            const commonProps = { ...controllerField, id: fieldName, placeholder: field.placeholder, className: cn('form-field', sizeClasses) };
                                            const fieldOptions = (field.options || '').split('\n').map(o => o.trim());

                                            switch(field.type) {
                                                case 'textarea': return <ZoruTextarea {...commonProps} />;
                                                case 'select': return <ZoruSelect onValueChange={controllerField.onChange} defaultValue={controllerField.value}><ZoruSelectTrigger className={cn('form-field', sizeClasses)}><ZoruSelectValue placeholder={field.placeholder || "Select..."} /></ZoruSelectTrigger><ZoruSelectContent>{fieldOptions.map(opt => <ZoruSelectItem key={opt} value={opt}>{opt}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect>;
                                                case 'checkbox': return <div className="flex items-center gap-2 pt-2"><ZoruCheckbox id={fieldName} checked={controllerField.value} onCheckedChange={controllerField.onChange} /><ZoruLabel htmlFor={fieldName} className="font-normal">{field.label}</ZoruLabel></div>;
                                                case 'acceptance': return <div className="flex items-center gap-2 pt-2"><ZoruCheckbox id={fieldName} checked={controllerField.value} onCheckedChange={controllerField.onChange} /><ZoruLabel htmlFor={fieldName} className="font-normal">{field.defaultValue || 'I agree to the terms.'}</ZoruLabel></div>;
                                                case 'radio': return <ZoruRadioGroup onValueChange={controllerField.onChange} defaultValue={controllerField.value} className="flex flex-col gap-2 pt-2">{fieldOptions.map(opt => <div key={opt} className="flex items-center space-x-2"><ZoruRadioGroupItem value={opt} id={`${fieldName}-${opt}`} /><ZoruLabel htmlFor={`${fieldName}-${opt}`} className="font-normal">{opt}</ZoruLabel></div>)}</ZoruRadioGroup>
                                                case 'file': return <ZoruInput {...commonProps} type="file" accept={field.allowedFileTypes} multiple={field.multiple} />;
                                                default: return <ZoruInput {...commonProps} type={field.type} />;
                                            }
                                        }}
                                    />
                                    {field.description && <p className="text-xs pt-1" style={descriptionStyle}>{field.description}</p>}
                                    {errors[fieldName] && <p className="text-sm font-medium text-destructive">{errors[fieldName]?.message as string}</p>}
                                </div>
                            </div>
                        )
                    })}
                     {submissionStatus === 'error' && <div className="col-span-12 p-4 bg-destructive/10 text-destructive text-sm rounded-md flex items-center gap-2"><AlertCircle className="h-4 w-4"/><p>{errorMessage}</p></div>}
                </ZoruCardContent>
                <ZoruCardFooter style={{justifyContent: settings.buttonAlign || 'flex-start'}}>
                    <ZoruButton id={settings.buttonId} type="submit" size={settings.buttonSize} className="submit-button" disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        {SubmitIcon && settings.buttonIconPosition === 'left' && <SubmitIcon className="mr-2 h-4 w-4" style={{marginRight: `${settings.buttonIconSpacing || 8}px`, width: settings.buttonIconSize, height: settings.buttonIconSize}}/>}
                        {settings.submitButtonText || 'Submit'}
                        {SubmitIcon && settings.buttonIconPosition === 'right' && <SubmitIcon className="ml-2 h-4 w-4" style={{marginLeft: `${settings.buttonIconSpacing || 8}px`, width: settings.buttonIconSize, height: settings.buttonIconSize}}/>}
                    </ZoruButton>
                </ZoruCardFooter>
            </form>
        </ZoruCard>
    );
};