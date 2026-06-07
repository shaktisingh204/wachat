"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    MoreVertical, Wifi, Battery, Signal, ChevronLeft, X,
    Camera, FileUp, ExternalLink, ChevronRight, Check,
} from "lucide-react";
import {
    Avatar, AvatarFallback, AvatarImage,
    Button, IconButton,
    Field, Input, Textarea, Label,
    Checkbox, Radio, RadioGroup,
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
    ScrollArea, cn,
} from '@/components/sabcrm/20ui';

/**
 * WhatsApp Flow phone preview. Renders every v7.3 component the
 * builder can produce, purely visually. Form interactivity is
 * deliberately local to the preview; nothing calls Meta.
 */

type FormState = Record<string, any>;
interface RenderProps {
    component: any;
    formData: FormState;
    setFormData: React.Dispatch<React.SetStateAction<FormState>>;
}

/* text family */

const TextHeadingR = ({ component }: { component: any }) => (
    <h1 className="mb-2 text-[26px] font-bold leading-tight text-[var(--st-text)]">{component.text}</h1>
);
const TextSubheadingR = ({ component }: { component: any }) => (
    <h2 className="mb-2 text-[18px] font-semibold leading-snug text-[var(--st-text)]">{component.text}</h2>
);
const TextBodyR = ({ component }: { component: any }) => {
    const cls = cn(
        'mb-2 text-[15px] leading-normal text-[var(--st-text)]',
        component['font-weight'] === 'bold' && 'font-bold',
        component['font-weight'] === 'italic' && 'italic',
        component['font-weight'] === 'bold_italic' && 'font-bold italic',
        component.strikethrough && 'line-through',
    );
    return <p className={cls}>{component.text}</p>;
};
const TextCaptionR = ({ component }: { component: any }) => (
    <p className={cn(
        'mb-2 text-[13px] leading-normal text-[var(--st-text)]',
        component.strikethrough && 'line-through',
    )}>{component.text}</p>
);
const RichTextR = ({ component }: { component: any }) => {
    const raw = Array.isArray(component.text) ? component.text.join('\n\n') : (component.text || '');
    return <div className="mb-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--st-text)]">{raw}</div>;
};

/* inputs */

const FieldLabel = ({ component }: { component: any }) => (
    <Label className="mb-1 block text-[12px] font-normal text-[var(--st-text)]" required={!!component.required}>
        {component.label}
    </Label>
);

const TextInputR = ({ component, formData, setFormData }: RenderProps) => (
    <Field
        className="mb-4"
        label={component.label}
        required={!!component.required}
        help={component['helper-text'] || undefined}
    >
        <Input
            type={component['input-type'] === 'password' ? 'password' : 'text'}
            inputMode={component['input-type'] === 'number' ? 'numeric' : component['input-type'] === 'email' ? 'email' : component['input-type'] === 'phone' ? 'tel' : undefined}
            value={formData[component.name] ?? ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.value }))}
            placeholder={component.placeholder}
            maxLength={component['max-chars']}
            disabled={component.enabled === false}
        />
    </Field>
);

const TextAreaR = ({ component, formData, setFormData }: RenderProps) => (
    <Field
        className="mb-4"
        label={component.label}
        required={!!component.required}
        help={component['helper-text'] || undefined}
    >
        <Textarea
            value={formData[component.name] ?? ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.value }))}
            maxLength={component['max-length']}
            disabled={component.enabled === false}
            className="min-h-[88px]"
        />
    </Field>
);

const DropdownR = ({ component, formData, setFormData }: RenderProps) => (
    <Field className="mb-4" label={component.label} required={!!component.required}>
        <Select
            value={formData[component.name] ?? ''}
            onValueChange={(val) => setFormData(prev => ({ ...prev, [component.name]: val }))}
            disabled={component.enabled === false}
        >
            <SelectTrigger aria-label={component.label || 'Select an option'}>
                <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
                {(component['data-source'] || []).map((item: any) => (
                    <SelectItem key={item.id} value={String(item.id)} disabled={item.enabled === false}>
                        {item.title}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </Field>
);

const RadioGroupR = ({ component, formData, setFormData }: RenderProps) => {
    const current = formData[component.name];
    return (
        <div className="mb-4">
            <FieldLabel component={component} />
            <RadioGroup
                value={current ?? ''}
                onValueChange={(val) => setFormData(prev => ({ ...prev, [component.name]: val }))}
                aria-label={component.label || 'Choose an option'}
                className="space-y-2"
            >
                {(component['data-source'] || []).map((item: any) => (
                    <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                        <Radio value={String(item.id)} disabled={item.enabled === false} />
                        <div className="flex-1">
                            <div className="text-[14.5px] text-[var(--st-text)]">{item.title}</div>
                            {item.description ? <div className="text-[12px] text-[var(--st-text-secondary)]">{item.description}</div> : null}
                        </div>
                    </label>
                ))}
            </RadioGroup>
        </div>
    );
};

const CheckboxGroupR = ({ component, formData, setFormData }: RenderProps) => {
    const current: string[] = Array.isArray(formData[component.name]) ? formData[component.name] : [];
    const toggle = (id: string) => {
        setFormData(prev => {
            const arr: string[] = Array.isArray(prev[component.name]) ? prev[component.name] : [];
            return { ...prev, [component.name]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
        });
    };
    return (
        <div className="mb-4">
            <FieldLabel component={component} />
            <div className="space-y-2">
                {(component['data-source'] || []).map((item: any) => (
                    <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                        <Checkbox
                            checked={current.includes(String(item.id))}
                            onChange={() => toggle(String(item.id))}
                            disabled={item.enabled === false}
                        />
                        <div className="flex-1">
                            <div className="text-[14.5px] text-[var(--st-text)]">{item.title}</div>
                            {item.description ? <div className="text-[12px] text-[var(--st-text-secondary)]">{item.description}</div> : null}
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
};

const ChipsSelectorR = ({ component, formData, setFormData }: RenderProps) => {
    const current: string[] = Array.isArray(formData[component.name]) ? formData[component.name] : [];
    const toggle = (id: string) => {
        setFormData(prev => {
            const arr: string[] = Array.isArray(prev[component.name]) ? prev[component.name] : [];
            return { ...prev, [component.name]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
        });
    };
    return (
        <div className="mb-4">
            <FieldLabel component={component} />
            <div className="flex flex-wrap gap-2">
                {(component['data-source'] || []).map((item: any) => {
                    const active = current.includes(String(item.id));
                    return (
                        <Button
                            key={item.id}
                            variant={active ? 'primary' : 'outline'}
                            size="sm"
                            aria-pressed={active}
                            onClick={() => toggle(String(item.id))}
                            className="rounded-full"
                        >
                            {item.title}
                        </Button>
                    );
                })}
            </div>
        </div>
    );
};

const DatePickerR = ({ component, formData, setFormData }: RenderProps) => (
    <Field className="mb-4" label={component.label} required={!!component.required}>
        <Input
            type="date"
            value={formData[component.name] ?? ''}
            min={component['min-date']}
            max={component['max-date']}
            onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.value }))}
        />
    </Field>
);

const CalendarPickerR = ({ component }: { component: any }) => (
    <div className="mb-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
        <FieldLabel component={component} />
        <div className="mt-2 text-center text-[12px] text-[var(--st-text-secondary)]">
            Inline calendar, {component.mode ?? 'single'} mode
        </div>
    </div>
);

const OptInR = ({ component, formData, setFormData }: RenderProps) => {
    const v = !!formData[component.name];
    return (
        <label className="mb-3 flex cursor-pointer items-start gap-3">
            <Checkbox
                className="mt-0.5"
                checked={v}
                onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.checked }))}
            />
            <span className="text-[13.5px] text-[var(--st-text)]">
                {component.label} {component.required ? <span className="text-[var(--st-danger)]">*</span> : null}
            </span>
        </label>
    );
};

/* media */

const ImageR = ({ component }: { component: any }) => {
    const src = component.src && !component.src.startsWith('data:') ? `data:image/png;base64,${component.src}` : component.src;
    if (!src) {
        return (
            <div className="mb-3 flex h-32 items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[11px] text-[var(--st-text-secondary)]">
                Image (set src to preview)
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={component['alt-text'] ?? ''}
            className={cn(
                'mb-3 w-full rounded-[var(--st-radius)]',
                component['scale-type'] === 'cover' ? 'object-cover' : 'object-contain',
            )}
            style={{ height: component.height || undefined, aspectRatio: component['aspect-ratio'] }}
        />
    );
};

const ImageCarouselR = ({ component }: { component: any }) => (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {(component.images || []).length === 0 ? (
            <div className="flex h-28 w-full items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[11px] text-[var(--st-text-secondary)]">
                Image carousel (add images)
            </div>
        ) : (component.images || []).map((img: any, i: number) => (
            <div key={i} className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                {img.src ? (
                    <img
                        src={img.src.startsWith('data:') ? img.src : `data:image/png;base64,${img.src}`}
                        alt={img['alt-text'] ?? ''}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[var(--st-text-secondary)]">image {i + 1}</div>
                )}
            </div>
        ))}
    </div>
);

const PhotoPickerR = ({ component }: { component: any }) => (
    <div className="mb-3 flex items-center gap-3 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
        <Camera className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
        <div className="flex-1">
            <div className="text-[13.5px] font-medium text-[var(--st-text)]">{component.label}</div>
            {component.description ? <div className="text-[11.5px] text-[var(--st-text-secondary)]">{component.description}</div> : null}
        </div>
    </div>
);

const DocumentPickerR = ({ component }: { component: any }) => (
    <div className="mb-3 flex items-center gap-3 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
        <FileUp className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
        <div className="flex-1">
            <div className="text-[13.5px] font-medium text-[var(--st-text)]">{component.label}</div>
            {component.description ? <div className="text-[11.5px] text-[var(--st-text-secondary)]">{component.description}</div> : null}
        </div>
    </div>
);

/* navigation */

const EmbeddedLinkR = ({ component }: { component: any }) => (
    <a className="mb-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--st-accent)]">
        {component.text} <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
);

const NavigationListR = ({ component }: { component: any }) => (
    <div className="mb-3 space-y-2">
        {(component['list-items'] || []).map((item: any, i: number) => (
            <div key={item.id || i} className="flex items-center gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                <div className="flex-1">
                    <div className="text-[14.5px] font-medium text-[var(--st-text)]">{item['main-content']?.title}</div>
                    {item['main-content']?.description ? <div className="text-[12px] text-[var(--st-text-secondary)]">{item['main-content'].description}</div> : null}
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            </div>
        ))}
        {(!component['list-items'] || component['list-items'].length === 0) ? (
            <div className="rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-center text-[11px] text-[var(--st-text-secondary)]">
                Navigation list (add items)
            </div>
        ) : null}
    </div>
);

/* fallback */

const GenericRenderer = ({ component }: { component: any }) => (
    <div className="mb-2 rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] p-2 text-center text-xs text-[var(--st-text-secondary)]">
        {component.type}{component.name ? ` · ${component.name}` : ''}
    </div>
);

/* dispatcher */

function FlowComponent(props: RenderProps) {
    const { component } = props;
    if (!component) return null;
    if (component.visible === false) return null;

    switch (component.type) {
        case 'TextHeading':      return <TextHeadingR component={component} />;
        case 'TextSubheading':   return <TextSubheadingR component={component} />;
        case 'TextBody':         return <TextBodyR component={component} />;
        case 'TextCaption':      return <TextCaptionR component={component} />;
        case 'RichText':         return <RichTextR component={component} />;

        case 'TextInput':        return <TextInputR {...props} />;
        case 'TextArea':         return <TextAreaR {...props} />;
        case 'Dropdown':         return <DropdownR {...props} />;
        case 'RadioButtonsGroup':return <RadioGroupR {...props} />;
        case 'CheckboxGroup':    return <CheckboxGroupR {...props} />;
        case 'ChipsSelector':    return <ChipsSelectorR {...props} />;
        case 'DatePicker':       return <DatePickerR {...props} />;
        case 'CalendarPicker':   return <CalendarPickerR component={component} />;
        case 'OptIn':            return <OptInR {...props} />;

        case 'Image':            return <ImageR component={component} />;
        case 'ImageCarousel':    return <ImageCarouselR component={component} />;
        case 'PhotoPicker':      return <PhotoPickerR component={component} />;
        case 'DocumentPicker':   return <DocumentPickerR component={component} />;

        case 'EmbeddedLink':     return <EmbeddedLinkR component={component} />;
        case 'NavigationList':   return <NavigationListR component={component} />;

        case 'Form':             return <>{(component.children || []).map((c: any, i: number) => <FlowComponent key={c.name || i} {...props} component={c} />)}</>;
        case 'If':               return <>{((props.formData._cond ?? true) ? (component.then || []) : (component.else || [])).map((c: any, i: number) => <FlowComponent key={i} {...props} component={c} />)}</>;
        case 'Switch':           return <>{(component.cases?.default || []).map((c: any, i: number) => <FlowComponent key={i} {...props} component={c} />)}</>;

        case 'Footer':           return null; // rendered separately
        default:                 return <GenericRenderer component={component} />;
    }
}

/* main preview */

export const MetaFlowPreview = ({
    flowJson,
    activeScreenId,
    className,
}: {
    flowJson: string;
    activeScreenId?: string | null;
    className?: string;
}) => {
    const [flow, setFlow] = useState<any>(null);
    const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormState>({});
    const [now, setNow] = useState('');

    useEffect(() => {
        const tick = () => setNow(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        tick();
        const t = setInterval(tick, 60_000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!flowJson) return;
        try {
            const parsed = JSON.parse(flowJson);
            setFlow(parsed);
            if (!currentScreenId || !parsed.screens?.some((s: any) => s.id === currentScreenId)) {
                setCurrentScreenId(parsed.screens?.[0]?.id ?? null);
            }
        } catch {
            /* ignore. The canvas surfaces the JSON error. */
        }
    }, [flowJson, currentScreenId]);

    useEffect(() => {
        if (activeScreenId) setCurrentScreenId(activeScreenId);
    }, [activeScreenId]);

    const currentScreen = useMemo(
        () => flow?.screens?.find((s: any) => s.id === currentScreenId),
        [flow, currentScreenId],
    );

    const { mainChildren, footer } = useMemo(() => {
        if (!currentScreen) return { mainChildren: [] as any[], footer: null as any };
        const children = currentScreen.layout?.children ?? [];
        const footerComp = children.find((c: any) => c?.type === 'Footer') ?? null;
        const rest = children.filter((c: any) => c?.type !== 'Footer');
        return { mainChildren: rest, footer: footerComp };
    }, [currentScreen]);

    if (!flow) {
        return <div className="flex h-full items-center justify-center text-xs text-[var(--st-text-secondary)]">Loading preview...</div>;
    }
    if (!currentScreen) {
        return <div className="flex h-full items-center justify-center text-xs text-[var(--st-text-secondary)]">Screen not found</div>;
    }

    return (
        <div
            className={cn(
                "relative flex select-none flex-col overflow-hidden bg-[var(--st-bg-muted)] font-sans",
                "bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d936cd0f1d.png')] bg-blend-overlay",
                className,
            )}
        >
            {/* status bar */}
            <div className="z-30 flex h-[44px] flex-shrink-0 items-center justify-between bg-[var(--st-bg-secondary)] px-6 text-[var(--st-text)]">
                <span className="text-[15px] font-semibold">{now}</span>
                <div className="flex items-center gap-1.5">
                    <Signal className="h-4 w-4" aria-hidden="true" />
                    <Wifi className="h-4 w-4" aria-hidden="true" />
                    <Battery className="h-[10px] w-[18px]" aria-hidden="true" />
                </div>
            </div>

            {/* wa chat header */}
            <div className="z-20 flex h-[60px] flex-shrink-0 items-center border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 shadow-sm">
                <IconButton label="Back" icon={ChevronLeft} className="-mr-1" />
                <div className="mr-1 text-[17px] text-[var(--st-text)]">2</div>
                <div className="ml-1 flex flex-1 items-center">
                    <Avatar className="mr-2 h-[36px] w-[36px]">
                        <AvatarImage src="https://github.com/shadcn.png" alt="Business avatar" />
                        <AvatarFallback>B</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-[16px] font-semibold leading-none text-[var(--st-text)]">Business name</span>
                        <span className="mt-1 text-[11px] leading-none text-[var(--st-text-secondary)]">Official business account</span>
                    </div>
                </div>
            </div>

            {/* chat fill */}
            <div className="flex flex-1 flex-col items-center overflow-auto p-4">
                <div className="mb-6 mt-4 rounded-[8px] bg-[var(--st-bg-muted)] px-3 py-1 shadow-sm">
                    <span className="text-[12px] font-medium text-[var(--st-text-secondary)]">TODAY</span>
                </div>
                <div className="mb-6 max-w-[85%] rounded-[8px] bg-[var(--st-bg-secondary)] px-4 py-2 text-center shadow-sm">
                    <span className="text-[12px] text-[var(--st-text-secondary)]">🔒 End-to-end encrypted.</span>
                </div>
                <div className="relative mb-2 max-w-[85%] self-start rounded-tr-lg rounded-br-lg rounded-bl-lg bg-[var(--st-bg-secondary)] p-1 shadow-sm">
                    <div className="p-2 pb-6">
                        <p className="text-[15px] leading-snug text-[var(--st-text)]">Hello! 👋 Click below to open the flow.</p>
                    </div>
                    <span className="absolute bottom-1 right-2 min-w-[30px] text-right text-[11px] text-[var(--st-text-secondary)]">{now}</span>
                </div>
                <div className="w-[85%] self-start">
                    <div className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-[var(--st-bg-secondary)] p-2 shadow-sm transition-colors hover:bg-[var(--st-bg-muted)]">
                        <span className="text-[15px] font-medium text-[var(--st-accent)]">View flow</span>
                    </div>
                </div>
            </div>

            {/* bottom input bar */}
            <div className="flex h-[80px] flex-shrink-0 items-center bg-[var(--st-bg-secondary)] px-4">
                <div className="flex h-[40px] flex-1 items-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] px-4 text-[15px] text-[var(--st-text-secondary)]">Message</div>
            </div>

            {/* flow modal overlay */}
            <div className="animate-in slide-in-from-bottom absolute inset-0 z-50 flex flex-col bg-[var(--st-bg)] duration-300">
                <div className="flex h-[56px] flex-shrink-0 items-center justify-between border-b border-[var(--st-border)] px-2">
                    <div className="flex items-center">
                        <IconButton label="Close flow" icon={X} />
                        <span className="ml-2 text-[17px] font-semibold text-[var(--st-text)]">{currentScreen.title || 'Flow'}</span>
                    </div>
                    <IconButton label="More options" icon={MoreVertical} />
                </div>

                <ScrollArea className="flex-1 bg-[var(--st-bg)]">
                    <div className="flex flex-col gap-2 p-4">
                        {mainChildren.map((c: any, i: number) => (
                            <FlowComponent
                                key={c.name || `${c.type}-${i}`}
                                component={c}
                                formData={formData}
                                setFormData={setFormData}
                            />
                        ))}
                    </div>
                </ScrollArea>

                {footer ? (
                    <div className="flex-shrink-0 border-t border-[var(--st-border)] bg-[var(--st-bg)] p-4">
                        <div className="flex flex-col gap-3">
                            <Button variant="primary" block className="h-[44px] rounded-full text-[15px] font-semibold">
                                {footer.label || 'Continue'}
                            </Button>
                            <div className="flex items-center justify-center gap-1 opacity-60">
                                <span className="text-[10px] text-[var(--st-text-secondary)]">Secured by</span>
                                <span className="text-[10px] font-bold text-[var(--st-text)]">Meta</span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
