"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    MoreVertical, Wifi, Battery, Signal, ChevronLeft, X,
    Camera, FileUp, ExternalLink, ChevronRight, Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * WhatsApp Flow phone preview — renders every v7.3 component the
 * builder can produce, purely visually. Form interactivity is
 * deliberately local to the preview; nothing calls Meta.
 */

type FormState = Record<string, any>;
interface RenderProps {
    component: any;
    formData: FormState;
    setFormData: React.Dispatch<React.SetStateAction<FormState>>;
}

/* ── text family ─────────────────────────────────────────────────── */

const TextHeadingR = ({ component }: { component: any }) => (
    <h1 className="mb-2 text-[26px] font-bold leading-tight text-gray-900">{component.text}</h1>
);
const TextSubheadingR = ({ component }: { component: any }) => (
    <h2 className="mb-2 text-[18px] font-semibold leading-snug text-gray-900">{component.text}</h2>
);
const TextBodyR = ({ component }: { component: any }) => {
    const cls = cn(
        'mb-2 text-[15px] leading-normal text-gray-800',
        component['font-weight'] === 'bold' && 'font-bold',
        component['font-weight'] === 'italic' && 'italic',
        component['font-weight'] === 'bold_italic' && 'font-bold italic',
        component.strikethrough && 'line-through',
    );
    return <p className={cls}>{component.text}</p>;
};
const TextCaptionR = ({ component }: { component: any }) => (
    <p className={cn(
        'mb-2 text-[13px] leading-normal text-gray-500',
        component.strikethrough && 'line-through',
    )}>{component.text}</p>
);
const RichTextR = ({ component }: { component: any }) => {
    const raw = Array.isArray(component.text) ? component.text.join('\n\n') : (component.text || '');
    return <div className="mb-2 whitespace-pre-wrap text-[14px] leading-relaxed text-gray-800">{raw}</div>;
};

/* ── inputs ─────────────────────────────────────────────────────── */

const FieldLabel = ({ component }: { component: any }) => (
    <Label className="mb-1 block text-[12px] font-normal text-gray-500">
        {component.label} {component.required ? <span className="text-red-500">*</span> : null}
    </Label>
);

const TextInputR = ({ component, formData, setFormData }: RenderProps) => (
    <div className="mb-4">
        <FieldLabel component={component} />
        <Input
            type={component['input-type'] === 'password' ? 'password' : 'text'}
            inputMode={component['input-type'] === 'number' ? 'numeric' : component['input-type'] === 'email' ? 'email' : component['input-type'] === 'phone' ? 'tel' : undefined}
            value={formData[component.name] ?? ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.value }))}
            placeholder={component.placeholder}
            maxLength={component['max-chars']}
            disabled={component.enabled === false}
            className="h-12 border-gray-300 bg-white text-[15px] focus-visible:ring-[#00A884]"
        />
        {component['helper-text'] ? <p className="mt-1 text-xs text-gray-500">{component['helper-text']}</p> : null}
    </div>
);

const TextAreaR = ({ component, formData, setFormData }: RenderProps) => (
    <div className="mb-4">
        <FieldLabel component={component} />
        <Textarea
            value={formData[component.name] ?? ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.value }))}
            maxLength={component['max-length']}
            disabled={component.enabled === false}
            className="min-h-[88px] border-gray-300 bg-white text-[15px] focus-visible:ring-[#00A884]"
        />
        {component['helper-text'] ? <p className="mt-1 text-xs text-gray-500">{component['helper-text']}</p> : null}
    </div>
);

const DropdownR = ({ component, formData, setFormData }: RenderProps) => (
    <div className="mb-4">
        <FieldLabel component={component} />
        <select
            value={formData[component.name] ?? ''}
            onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.value }))}
            disabled={component.enabled === false}
            className="h-12 w-full rounded-md border border-gray-300 bg-white px-3 text-[15px] text-gray-900"
        >
            <option value="">Select…</option>
            {(component['data-source'] || []).map((item: any) => (
                <option key={item.id} value={item.id} disabled={item.enabled === false}>{item.title}</option>
            ))}
        </select>
    </div>
);

const RadioGroupR = ({ component, formData, setFormData }: RenderProps) => {
    const current = formData[component.name];
    return (
        <div className="mb-4">
            <FieldLabel component={component} />
            <div className="space-y-2">
                {(component['data-source'] || []).map((item: any) => (
                    <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 bg-white p-3">
                        <span className={cn(
                            'flex h-4 w-4 items-center justify-center rounded-full border-2',
                            current === item.id ? 'border-[#00A884]' : 'border-gray-300',
                        )}>
                            {current === item.id ? <span className="h-2 w-2 rounded-full bg-[#00A884]" /> : null}
                        </span>
                        <input
                            type="radio"
                            name={component.name}
                            value={item.id}
                            checked={current === item.id}
                            onChange={() => setFormData(prev => ({ ...prev, [component.name]: item.id }))}
                            className="sr-only"
                        />
                        <div className="flex-1">
                            <div className="text-[14.5px] text-gray-900">{item.title}</div>
                            {item.description ? <div className="text-[12px] text-gray-500">{item.description}</div> : null}
                        </div>
                    </label>
                ))}
            </div>
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
                    <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 bg-white p-3">
                        <span className={cn(
                            'flex h-4 w-4 items-center justify-center rounded border-2',
                            current.includes(item.id) ? 'border-[#00A884] bg-[#00A884]' : 'border-gray-300',
                        )}>
                            {current.includes(item.id) ? <Check className="h-3 w-3 text-white" /> : null}
                        </span>
                        <input
                            type="checkbox"
                            checked={current.includes(item.id)}
                            onChange={() => toggle(item.id)}
                            className="sr-only"
                        />
                        <div className="flex-1">
                            <div className="text-[14.5px] text-gray-900">{item.title}</div>
                            {item.description ? <div className="text-[12px] text-gray-500">{item.description}</div> : null}
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
                {(component['data-source'] || []).map((item: any) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => toggle(item.id)}
                        className={cn(
                            'rounded-full border px-3 py-1 text-[13px] transition-colors',
                            current.includes(item.id)
                                ? 'border-[#00A884] bg-[#00A884]/10 text-[#00A884]'
                                : 'border-gray-300 bg-white text-gray-800',
                        )}
                    >
                        {item.title}
                    </button>
                ))}
            </div>
        </div>
    );
};

const DatePickerR = ({ component, formData, setFormData }: RenderProps) => (
    <div className="mb-4">
        <FieldLabel component={component} />
        <Input
            type="date"
            value={formData[component.name] ?? ''}
            min={component['min-date']}
            max={component['max-date']}
            onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.value }))}
            className="h-12 border-gray-300 bg-white text-[15px] focus-visible:ring-[#00A884]"
        />
    </div>
);

const CalendarPickerR = ({ component }: { component: any }) => (
    <div className="mb-4 rounded-md border border-gray-200 bg-white p-3">
        <FieldLabel component={component} />
        <div className="mt-2 text-center text-[12px] text-gray-400">
            [Inline calendar · {component.mode ?? 'single'} mode]
        </div>
    </div>
);

const OptInR = ({ component, formData, setFormData }: RenderProps) => {
    const v = !!formData[component.name];
    return (
        <label className="mb-3 flex cursor-pointer items-start gap-3">
            <span className={cn(
                'mt-0.5 flex h-4 w-4 items-center justify-center rounded border-2',
                v ? 'border-[#00A884] bg-[#00A884]' : 'border-gray-300',
            )}>
                {v ? <Check className="h-3 w-3 text-white" /> : null}
            </span>
            <input
                type="checkbox"
                checked={v}
                onChange={(e) => setFormData(prev => ({ ...prev, [component.name]: e.target.checked }))}
                className="sr-only"
            />
            <span className="text-[13.5px] text-gray-700">
                {component.label} {component.required ? <span className="text-red-500">*</span> : null}
            </span>
        </label>
    );
};

/* ── media ───────────────────────────────────────────────────────── */

const ImageR = ({ component }: { component: any }) => {
    const src = component.src && !component.src.startsWith('data:') ? `data:image/png;base64,${component.src}` : component.src;
    if (!src) {
        return (
            <div className="mb-3 flex h-32 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-[11px] text-gray-400">
                Image (set src to preview)
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={component['alt-text'] ?? ''}
            className={cn(
                'mb-3 w-full rounded-md',
                component['scale-type'] === 'cover' ? 'object-cover' : 'object-contain',
            )}
            style={{ height: component.height || undefined, aspectRatio: component['aspect-ratio'] }}
        />
    );
};

const ImageCarouselR = ({ component }: { component: any }) => (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {(component.images || []).length === 0 ? (
            <div className="flex h-28 w-full items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-[11px] text-gray-400">
                Image carousel (add images)
            </div>
        ) : (component.images || []).map((img: any, i: number) => (
            <div key={i} className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                {img.src ? (
                    <img
                        src={img.src.startsWith('data:') ? img.src : `data:image/png;base64,${img.src}`}
                        alt={img['alt-text'] ?? ''}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-gray-400">image {i + 1}</div>
                )}
            </div>
        ))}
    </div>
);

const PhotoPickerR = ({ component }: { component: any }) => (
    <div className="mb-3 flex items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
        <Camera className="h-5 w-5 text-gray-400" />
        <div className="flex-1">
            <div className="text-[13.5px] font-medium text-gray-800">{component.label}</div>
            {component.description ? <div className="text-[11.5px] text-gray-500">{component.description}</div> : null}
        </div>
    </div>
);

const DocumentPickerR = ({ component }: { component: any }) => (
    <div className="mb-3 flex items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
        <FileUp className="h-5 w-5 text-gray-400" />
        <div className="flex-1">
            <div className="text-[13.5px] font-medium text-gray-800">{component.label}</div>
            {component.description ? <div className="text-[11.5px] text-gray-500">{component.description}</div> : null}
        </div>
    </div>
);

/* ── navigation ──────────────────────────────────────────────────── */

const EmbeddedLinkR = ({ component }: { component: any }) => (
    <a className="mb-3 inline-flex items-center gap-1 text-[14px] font-medium text-[#00A884]">
        {component.text} <ExternalLink className="h-3 w-3" />
    </a>
);

const NavigationListR = ({ component }: { component: any }) => (
    <div className="mb-3 space-y-2">
        {(component['list-items'] || []).map((item: any, i: number) => (
            <div key={item.id || i} className="flex items-center gap-3 rounded-md border border-gray-200 bg-white p-3">
                <div className="flex-1">
                    <div className="text-[14.5px] font-medium text-gray-900">{item['main-content']?.title}</div>
                    {item['main-content']?.description ? <div className="text-[12px] text-gray-500">{item['main-content'].description}</div> : null}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
        ))}
        {(!component['list-items'] || component['list-items'].length === 0) ? (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-center text-[11px] text-gray-400">
                Navigation list (add items)
            </div>
        ) : null}
    </div>
);

/* ── fallback ────────────────────────────────────────────────────── */

const GenericRenderer = ({ component }: { component: any }) => (
    <div className="mb-2 rounded border border-dashed border-gray-300 p-2 text-center text-xs text-gray-400">
        {component.type}{component.name ? ` · ${component.name}` : ''}
    </div>
);

/* ── dispatcher ──────────────────────────────────────────────────── */

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

/* ── main preview ────────────────────────────────────────────────── */

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
            /* ignore — canvas surfaces the JSON error */
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
        return <div className="flex h-full items-center justify-center text-xs text-gray-400">Loading preview…</div>;
    }
    if (!currentScreen) {
        return <div className="flex h-full items-center justify-center text-xs text-red-400">Screen not found</div>;
    }

    return (
        <div
            className={cn("relative flex select-none flex-col overflow-hidden bg-[#ECE5DD] font-sans", className)}
            style={{
                backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d936cd0f1d.png')",
                backgroundBlendMode: "overlay",
            }}
        >
            {/* status bar */}
            <div className="z-30 flex h-[44px] flex-shrink-0 items-center justify-between bg-[#F0F2F5] px-6 text-black">
                <span className="text-[15px] font-semibold">{now}</span>
                <div className="flex items-center gap-1.5">
                    <Signal className="h-4 w-4 fill-black" />
                    <Wifi className="h-4 w-4" />
                    <Battery className="h-[10px] w-[18px]" />
                </div>
            </div>

            {/* wa chat header */}
            <div className="z-20 flex h-[60px] flex-shrink-0 items-center border-b border-[#e2e2e2] bg-[#F0F2F5] px-2 shadow-sm">
                <Button variant="ghost" size="icon" className="-mr-1 text-[#007AFF]"><ChevronLeft className="h-6 w-6" /></Button>
                <div className="mr-1 text-[17px] text-[#007AFF]">2</div>
                <div className="ml-1 flex flex-1 items-center">
                    <Avatar className="mr-2 h-[36px] w-[36px]">
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>B</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-[16px] font-semibold leading-none text-black">Business name</span>
                        <span className="mt-1 text-[11px] leading-none text-gray-500">Official business account</span>
                    </div>
                </div>
            </div>

            {/* chat fill */}
            <div className="flex flex-1 flex-col items-center overflow-auto p-4">
                <div className="mb-6 mt-4 rounded-[8px] bg-[#DDDDE4] px-3 py-1 shadow-sm">
                    <span className="text-[12px] font-medium text-gray-600">TODAY</span>
                </div>
                <div className="mb-6 max-w-[85%] rounded-[8px] bg-[#FEF9C3] px-4 py-2 text-center shadow-sm">
                    <span className="text-[12px] text-gray-600">🔒 End-to-end encrypted.</span>
                </div>
                <div className="relative mb-2 max-w-[85%] self-start rounded-tr-lg rounded-br-lg rounded-bl-lg bg-white p-1 shadow-sm">
                    <div className="p-2 pb-6">
                        <p className="text-[15px] leading-snug text-black">Hello! 👋 Click below to open the flow.</p>
                    </div>
                    <span className="absolute bottom-1 right-2 min-w-[30px] text-right text-[11px] text-gray-400">{now}</span>
                </div>
                <div className="w-[85%] self-start">
                    <div className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white p-2 shadow-sm transition-colors hover:bg-gray-50">
                        <span className="text-[15px] font-medium text-[#00A884]">View flow</span>
                    </div>
                </div>
            </div>

            {/* bottom input bar */}
            <div className="flex h-[80px] flex-shrink-0 items-center bg-[#F0F2F5] px-4">
                <div className="flex h-[40px] flex-1 items-center rounded-full border border-gray-300 bg-white px-4 text-[15px] text-gray-400">Message…</div>
            </div>

            {/* flow modal overlay */}
            <div className="animate-in slide-in-from-bottom absolute inset-0 z-50 flex flex-col bg-white duration-300">
                <div className="flex h-[56px] flex-shrink-0 items-center justify-between border-b border-gray-100 px-2">
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" className="text-gray-900"><X className="h-6 w-6" /></Button>
                        <span className="ml-2 text-[17px] font-semibold text-gray-900">{currentScreen.title || 'Flow'}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-gray-900"><MoreVertical className="h-5 w-5" /></Button>
                </div>

                <ScrollArea className="flex-1 bg-white">
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
                    <div className="flex-shrink-0 border-t border-gray-100 bg-white p-4">
                        <div className="flex flex-col gap-3">
                            <Button className="h-[44px] w-full rounded-full bg-[#00A884] text-[15px] font-semibold text-white shadow-none hover:bg-[#008f6f]">
                                {footer.label || 'Continue'}
                            </Button>
                            <div className="flex items-center justify-center gap-1 opacity-60">
                                <span className="text-[10px] text-gray-500">Secured by</span>
                                <span className="text-[10px] font-bold text-gray-600">Meta</span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
