'use client';

import {
  Button,
  IconButton,
  Input,
  Textarea,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Card,
  Alert,
  EmptyState,
  Badge,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  useForm,
  Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import { LoaderCircle,
  CheckCircle,
  Star } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { FormField,
  FormPage,
  WithId,
  CrmForm } from '@/lib/definitions';

import Image from 'next/image';

interface EmbeddedFormProps {
  form: WithId<CrmForm>;
}

interface AddressValue {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
}

const FONT_FAMILIES: Record<string, string> = {
    system: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    inter: 'Inter, system-ui, sans-serif',
    roboto: 'Roboto, system-ui, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
};

function fieldNameOf(field: FormField): string {
    return field.fieldId || field.id;
}

function buildPages(settings: Record<string, unknown>): FormPage[] {
    const pages = (settings.pages as FormPage[] | undefined);
    if (Array.isArray(pages) && pages.length > 0) return pages;
    const fields = (settings.fields as FormField[] | undefined) || [];
    return [{ id: '__legacy__', title: 'Form', fields }];
}

// Stars renderer for `rating` field type.
function StarRating({ value, max, onChange, disabled }: {
    value: number;
    max: number;
    onChange: (v: number) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-center gap-1">
            {Array.from({ length: max }).map((_, i) => {
                const filled = i < value;
                return (
                    <IconButton
                        key={i}
                        icon={Star}
                        label={`${i + 1} star${i ? 's' : ''}`}
                        disabled={disabled}
                        onClick={() => onChange(i + 1)}
                        className={cn(
                            'text-[var(--st-text-secondary)]',
                            filled && '[&_svg]:fill-[var(--st-text-secondary)]',
                        )}
                    />
                );
            })}
        </div>
    );
}

export const EmbeddedForm: React.FC<EmbeddedFormProps> = ({ form }) => {
    const { toast } = useToast();
    const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const [currentPageIdx, setCurrentPageIdx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const settings = (form.settings || {}) as Record<string, unknown>;

    useEffect(() => {
        if (containerRef.current) {
            const resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const height = entry.contentRect.height;
                    window.parent.postMessage({ type: 'sabnodeFormHeight', height: height, formId: form._id.toString() }, '*');
                }
            });
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, [form._id]);

    const pages = useMemo(() => buildPages(settings), [settings]);
    const allFields = useMemo(() => pages.flatMap(p => p.fields), [pages]);
    const isMultiStep = pages.length > 1;

    const theme = (settings.theme as {
        primaryColor?: string;
        fontFamily?: string;
        borderRadius?: number;
        logoFileUrl?: string;
        backgroundFileUrl?: string;
    } | undefined) || {};

    const postSubmit = (settings.postSubmit as {
        successMessage?: string;
        redirectUrl?: string;
    } | undefined) || {};

    const validationSchema = useMemo(() => {
        const schemaObject: Record<string, z.ZodType> = {};
        allFields.forEach((field) => {
            if (field.type === 'hidden' || field.type === 'html') return;
            const fieldName = fieldNameOf(field);
            let fieldSchema: z.ZodType;

            switch (field.type) {
                case 'email':
                    fieldSchema = z.string().email({ message: 'Invalid email address' });
                    break;
                case 'url':
                    fieldSchema = z.string().url({ message: 'Invalid URL' });
                    break;
                case 'number':
                case 'rating':
                    fieldSchema = z.union([z.string(), z.number()]).refine(
                        (val) => val === '' || val == null || !isNaN(Number(val)),
                        { message: 'Must be a number' },
                    );
                    break;
                case 'checkbox':
                    fieldSchema = z.boolean();
                    if (field.required) fieldSchema = (fieldSchema as z.ZodBoolean).refine(val => val === true, { message: `${field.label} is required` });
                    break;
                case 'acceptance':
                    fieldSchema = z.boolean().refine(val => val === true, { message: 'You must accept the terms.' });
                    break;
                case 'select':
                    fieldSchema = field.multiple
                        ? z.array(z.string())
                        : z.string();
                    break;
                case 'address':
                    fieldSchema = z.object({
                        line1: z.string().optional(),
                        line2: z.string().optional(),
                        city: z.string().optional(),
                        state: z.string().optional(),
                        zip: z.string().optional(),
                        country: z.string().optional(),
                    });
                    break;
                case 'file':
                case 'signature':
                    fieldSchema = z.any();
                    break;
                default:
                    fieldSchema = z.string();
            }

            const v = field.validation || {};
            if (fieldSchema instanceof z.ZodString) {
                let stringSchema = fieldSchema;
                if (typeof v.minLength === 'number') stringSchema = stringSchema.min(v.minLength, { message: v.errorMessage || `Min ${v.minLength} characters` });
                if (typeof v.maxLength === 'number') stringSchema = stringSchema.max(v.maxLength, { message: v.errorMessage || `Max ${v.maxLength} characters` });
                if (v.pattern) {
                    try {
                        const re = new RegExp(v.pattern);
                        stringSchema = stringSchema.regex(re, { message: v.errorMessage || 'Invalid format' });
                    } catch {
                        // Invalid regex stored on the form. Silently skip.
                    }
                }
                fieldSchema = stringSchema;
            }

            if (field.required && !['checkbox', 'acceptance', 'select', 'address', 'file', 'signature', 'rating'].includes(field.type)) {
                if (fieldSchema instanceof z.ZodString) {
                    fieldSchema = fieldSchema.min(1, { message: `${field.label} is required` });
                }
            }
            if (field.required && field.type === 'rating') {
                fieldSchema = fieldSchema.refine(v2 => Number(v2) > 0, { message: `${field.label} is required` });
            }
            if (!field.required) {
                fieldSchema = fieldSchema.optional();
            }

            schemaObject[fieldName] = fieldSchema;
        });
        return z.object(schemaObject);
    }, [allFields]);

    const defaultValues = useMemo(() => {
        return allFields.reduce<Record<string, unknown>>((acc, field) => {
            const name = fieldNameOf(field);
            if (field.type === 'checkbox' || field.type === 'acceptance') acc[name] = false;
            else if (field.type === 'address') acc[name] = { line1: '', line2: '', city: '', state: '', zip: '', country: '' };
            else if (field.type === 'rating') acc[name] = 0;
            else if (field.multiple) acc[name] = [];
            else acc[name] = field.defaultValue ?? '';
            return acc;
        }, {});
    }, [allFields]);

    const formHook = useForm({
        resolver: zodResolver(validationSchema),
        defaultValues,
    });

    const { control, handleSubmit, formState: { errors }, trigger, getValues } = formHook;

    // Cross-field conditional required. Manually evaluated before submit.
    const evaluateConditionalRequired = (): string | null => {
        const values = getValues();
        for (const f of allFields) {
            const ri = f.validation?.requireIf;
            if (!ri) continue;
            const refVal = values[ri.fieldId];
            const fName = fieldNameOf(f);
            const ownVal = values[fName];
            const isOwnEmpty = ownVal == null || ownVal === '' || (Array.isArray(ownVal) && ownVal.length === 0);
            let shouldRequire = false;
            if (ri.operator === 'isFilled') shouldRequire = refVal != null && refVal !== '';
            else if (ri.operator === 'equals') shouldRequire = String(refVal ?? '') === String(ri.value ?? '');
            else if (ri.operator === 'notEquals') shouldRequire = String(refVal ?? '') !== String(ri.value ?? '');
            if (shouldRequire && isOwnEmpty) {
                return `${f.label} is required`;
            }
        }
        return null;
    };

    async function onSubmit(data: Record<string, unknown>) {
        const condErr = evaluateConditionalRequired();
        if (condErr) {
            setSubmissionStatus('error');
            setErrorMessage(condErr);
            toast.error(condErr);
            return;
        }
        startTransition(async () => {
            setSubmissionStatus('submitting');
            setErrorMessage('');
            try {
                const dataToSend = JSON.parse(JSON.stringify(data));
                const response = await fetch(`/api/crm/forms/submit/${form._id.toString()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSend),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Submission failed.');
                if (result.redirectUrl) {
                    window.location.href = result.redirectUrl;
                    return;
                }
                const ok = result.message || postSubmit.successMessage || 'Thank you! Your submission has been received.';
                setSuccessMessage(ok);
                toast.success(ok);
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'An unknown error occurred.';
                setSubmissionStatus('error');
                setErrorMessage(msg);
                toast.error(msg);
            }
        });
    }

    async function goToNextPage() {
        const current = pages[currentPageIdx];
        const names = current.fields.filter(f => f.type !== 'html' && f.type !== 'hidden').map(fieldNameOf);
        const ok = await trigger(names);
        if (ok) setCurrentPageIdx(idx => Math.min(idx + 1, pages.length - 1));
    }

    if (successMessage) {
        return (
            <div ref={containerRef} className="ui20 p-8">
                <EmptyState
                    icon={CheckCircle}
                    tone="success"
                    title={successMessage}
                />
            </div>
        );
    }

    const uniqueId = `form-${form._id.toString()}`;
    const themeRadius = theme.borderRadius;
    const themeFont = theme.fontFamily ? FONT_FAMILIES[theme.fontFamily] || theme.fontFamily : undefined;
    const dynamicStyles = `
      body { background-color: transparent !important; }
      #${uniqueId} {
        max-width: ${(settings.formWidth as number) || 480}px !important;
        margin-left: auto !important;
        margin-right: auto !important;
        ${theme.primaryColor ? `--sabnode-form-primary: ${theme.primaryColor};` : ''}
        ${themeFont ? `font-family: ${themeFont};` : ''}
        ${theme.backgroundFileUrl ? `background-image: url('${theme.backgroundFileUrl}'); background-size: cover; background-position: center;` : ''}
      }
      #${uniqueId} .form-field {
        color: ${(settings.fieldColor as string) || 'inherit'};
        background-color: ${(settings.fieldBgColor as string) || 'transparent'};
        border-color: ${(settings.fieldBorderColor as string) || 'var(--st-border)'};
        border-radius: ${themeRadius != null ? `${themeRadius}px` : `${(settings.fieldBorderRadius as number) ?? 6}px`};
        padding: ${(settings.fieldPadding as number) ?? 8}px;
        border-width: ${(settings.fieldBorderWidth as number) || 1}px;
        border-style: ${(settings.fieldBorderType as string) || 'solid'};
      }
      #${uniqueId} .form-field:focus {
        border-color: ${theme.primaryColor || (settings.fieldFocusBorderColor as string) || 'var(--st-accent)'} !important;
        box-shadow: 0 0 0 1px ${theme.primaryColor || (settings.fieldFocusBorderColor as string) || 'var(--st-accent)'} !important;
      }
      #${uniqueId} .submit-button {
        color: ${(settings.buttonColor as string) || 'var(--st-text-inverted)'};
        background-color: ${theme.primaryColor || (settings.buttonBgColor as string) || 'var(--st-accent)'};
        border-radius: ${themeRadius != null ? `${themeRadius}px` : `${(settings.buttonBorderRadius as number) ?? 6}px`};
        padding: ${(settings.buttonPadding as number) ?? 10}px;
      }
    `;

    const buttonIconName = settings.buttonIcon as string | undefined;
    const SubmitIcon = buttonIconName ? (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[buttonIconName] : null;

    const renderField = (field: FormField) => {
        const widthClasses: Record<string, string> = { '100%': 'col-span-12', '50%': 'col-span-12 sm:col-span-6', '33.33%': 'col-span-12 sm:col-span-4', '25%': 'col-span-12 sm:col-span-3' };
        const sizeClasses = { sm: 'h-8 text-xs', md: 'h-10 text-sm', lg: 'h-12 text-base'}[field.size || 'md'];

        if (field.type === 'hidden') {
            return (
                <Controller
                    key={field.id}
                    name={fieldNameOf(field)}
                    control={control}
                    render={({ field: cf }) => <input type="hidden" {...cf} value={(cf.value as string) ?? ''} />}
                />
            );
        }

        if (field.type === 'html') {
            return (
                <div
                    key={field.id}
                    className={cn(widthClasses[field.columnWidth || '100%'])}
                    dangerouslySetInnerHTML={{ __html: field.htmlContent || '' }}
                />
            );
        }

        const fieldName = fieldNameOf(field);

        return (
            <div key={field.id} className={cn('space-y-2', widthClasses[field.columnWidth || '100%'], field.labelPosition === 'inline' && 'flex items-center gap-4')}>
                {field.labelPosition !== 'hidden' && (
                    <Label
                        htmlFor={fieldName}
                        required={field.required}
                        className={cn(field.labelPosition === 'inline' && 'flex-shrink-0', (field.type === 'checkbox' || field.type === 'acceptance') && 'hidden')}
                    >
                        {field.label}
                    </Label>
                )}
                <div className="w-full">
                    <Controller
                        name={fieldName}
                        control={control}
                        render={({ field: controllerField }) => {
                            const commonProps = { ...controllerField, value: (controllerField.value as string | number | undefined) ?? '', id: fieldName, placeholder: field.placeholder, className: cn('form-field w-full', sizeClasses) };
                            const fieldOptions = (field.options || '').split('\n').map(o => o.trim()).filter(Boolean);

                            switch (field.type) {
                                case 'textarea':
                                    return <Textarea {...commonProps} />;
                                case 'select':
                                    return (
                                        <Select onValueChange={controllerField.onChange} value={(controllerField.value as string) || ''}>
                                            <SelectTrigger className={cn('form-field', sizeClasses)} aria-label={field.label}>
                                                <SelectValue placeholder={field.placeholder || 'Select...'} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fieldOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    );
                                case 'checkbox':
                                    return (
                                        <div className="flex items-center gap-2 pt-2">
                                            <Checkbox id={fieldName} checked={!!controllerField.value} onChange={(e) => controllerField.onChange(e.target.checked)} label={field.label} />
                                        </div>
                                    );
                                case 'acceptance':
                                    return (
                                        <div className="flex items-center gap-2 pt-2">
                                            <Checkbox id={fieldName} checked={!!controllerField.value} onChange={(e) => controllerField.onChange(e.target.checked)} label={field.defaultValue || 'I agree to the terms.'} />
                                        </div>
                                    );
                                case 'radio':
                                    return (
                                        <RadioGroup onValueChange={controllerField.onChange} value={(controllerField.value as string) || ''} className="pt-2" aria-label={field.label}>
                                            {fieldOptions.map(opt => (
                                                <RadioGroupItem key={opt} value={opt} id={`${fieldName}-${opt}`} label={opt} />
                                            ))}
                                        </RadioGroup>
                                    );
                                case 'phone':
                                    return <Input {...commonProps} type="tel" inputMode="tel" placeholder={field.placeholder || '+1 555 123 4567'} />;
                                case 'address': {
                                    const addr = (controllerField.value as AddressValue) || {};
                                    const setPart = (k: keyof AddressValue, v: string) => controllerField.onChange({ ...addr, [k]: v });
                                    return (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input className="col-span-2 form-field" value={addr.line1 || ''} onChange={(e) => setPart('line1', e.target.value)} placeholder="Address line 1" aria-label="Address line 1" />
                                            <Input className="col-span-2 form-field" value={addr.line2 || ''} onChange={(e) => setPart('line2', e.target.value)} placeholder="Address line 2" aria-label="Address line 2" />
                                            <Input className="form-field" value={addr.city || ''} onChange={(e) => setPart('city', e.target.value)} placeholder="City" aria-label="City" />
                                            <Input className="form-field" value={addr.state || ''} onChange={(e) => setPart('state', e.target.value)} placeholder="State / Region" aria-label="State or region" />
                                            <Input className="form-field" value={addr.zip || ''} onChange={(e) => setPart('zip', e.target.value)} placeholder="ZIP / Postal code" aria-label="ZIP or postal code" />
                                            <Input className="form-field" value={addr.country || ''} onChange={(e) => setPart('country', e.target.value)} placeholder="Country" aria-label="Country" />
                                        </div>
                                    );
                                }
                                case 'rating':
                                    return (
                                        <StarRating
                                            value={Number(controllerField.value) || 0}
                                            max={field.maxRating || 5}
                                            onChange={(v) => controllerField.onChange(v)}
                                        />
                                    );
                                case 'signature':
                                    // Signature canvas requires `react-signature-canvas` (not in package.json).
                                    // Leave a typed placeholder so the field still submits; user can type their name.
                                    // TODO: when react-signature-canvas is added, swap to a signature pad and store dataURL.
                                    return <Input {...commonProps} placeholder={field.placeholder || 'Type your name as signature'} />;
                                case 'file': {
                                    // SabFiles policy: file inputs source from the SabFiles picker (library + upload),
                                    // never a free-text URL. We store the picked file's stable SabFiles URL as the value.
                                    const pickedUrl = (controllerField.value as string) || '';
                                    return (
                                        <div className="flex items-center gap-3">
                                            <SabFilePickerButton
                                                onPick={(pick) => controllerField.onChange(pick.url)}
                                            >
                                                {pickedUrl ? 'Replace file' : 'Choose file'}
                                            </SabFilePickerButton>
                                            {pickedUrl && (
                                                <span className="truncate text-sm text-[var(--st-text-secondary)]">
                                                    {decodeURIComponent(pickedUrl.split('/').pop() || pickedUrl)}
                                                </span>
                                            )}
                                        </div>
                                    );
                                }
                                default:
                                    return <Input {...commonProps} type={field.type} />;
                            }
                        }}
                    />
                    {field.description && <p className="text-xs pt-1 text-[var(--st-text-secondary)]">{field.description}</p>}
                    {errors[fieldName] && <p className="text-sm font-medium text-[var(--st-danger)]">{errors[fieldName]?.message as string}</p>}
                </div>
            </div>
        );
    };

    const currentPage = pages[currentPageIdx] ?? pages[0];
    const isLastPage = currentPageIdx === pages.length - 1;
    const logoSrc = theme.logoFileUrl || (settings.logoUrl as string | undefined);

    return (
        <div ref={containerRef} className="ui20 p-2">
            <style>{dynamicStyles}</style>
            <Card padding="none" className="shadow-md w-full" id={uniqueId}>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="text-center my-6 px-6">
                        {logoSrc && <Image src={logoSrc} alt="Logo" width={80} height={80} className="object-contain mx-auto" />}
                        <h1 className="text-2xl font-bold mt-4 text-[var(--st-text)]">{(settings.title as string) || 'Form Title'}</h1>
                        <p className="text-[var(--st-text-secondary)]">{(settings.description as string) || ''}</p>
                    </div>

                    {isMultiStep && (
                        <div className="px-6 pb-4 flex items-center justify-center gap-2 flex-wrap">
                            {pages.map((p, i) => (
                                <Badge
                                    key={p.id}
                                    tone={i === currentPageIdx ? 'accent' : 'neutral'}
                                    kind={i === currentPageIdx ? 'solid' : 'soft'}
                                    style={i === currentPageIdx && theme.primaryColor ? { backgroundColor: theme.primaryColor, color: 'var(--st-text-inverted)' } : undefined}
                                >
                                    {i + 1}. {p.title}
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Render hidden fields globally so values are always present. */}
                    {allFields.filter(f => f.type === 'hidden').map(renderField)}

                    <div className="p-6 pt-0 grid grid-cols-12" style={{ gap: `${(settings.fieldSpacing as number) || 24}px` }}>
                        {currentPage.fields.filter(f => f.type !== 'hidden').map(renderField)}
                        {submissionStatus === 'error' && errorMessage && (
                            <div className="col-span-12">
                                <Alert tone="danger">{errorMessage}</Alert>
                            </div>
                        )}
                    </div>

                    <div className="p-6 pt-0 flex items-center gap-2 justify-between">
                        {isMultiStep && currentPageIdx > 0 ? (
                            <Button type="button" variant="outline" onClick={() => setCurrentPageIdx(idx => Math.max(0, idx - 1))}>
                                Back
                            </Button>
                        ) : <span />}

                        {isMultiStep && !isLastPage ? (
                            <Button type="button" variant="primary" onClick={goToNextPage} className="submit-button">
                                Next
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                variant="primary"
                                className="submit-button"
                                disabled={isPending}
                                iconLeft={SubmitIcon && (settings.buttonIconPosition as string) === 'left' ? (SubmitIcon as typeof Star) : undefined}
                                iconRight={SubmitIcon && (settings.buttonIconPosition as string) === 'right' ? (SubmitIcon as typeof Star) : undefined}
                            >
                                {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                {(settings.submitButtonText as string) || 'Submit'}
                            </Button>
                        )}
                    </div>
                    {(settings.footerText as string) && (
                        <div className="px-6 pb-4">
                            <p className="text-xs text-[var(--st-text-secondary)] text-center" dangerouslySetInnerHTML={{ __html: settings.footerText as string }} />
                        </div>
                    )}
                </form>
            </Card>
        </div>
    );
};
