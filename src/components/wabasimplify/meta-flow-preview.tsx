
"use client";

import React, { useState, useEffect } from "react";
import {
    ArrowLeft,
    MoreVertical,
    Wifi,
    Battery,
    Signal,
    ChevronLeft,
    X
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// --- Types ---

interface FlowComponentProps {
    component: any;
    formData: Record<string, any>;
    setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

// --- Component Renderers ---

const TextRenderer = ({ component }: { component: any }) => {
    const alignMap: Record<string, string> = {
        'start': 'text-left',
        'center': 'text-center',
        'end': 'text-right'
    };
    const sizeMap: Record<string, string> = {
        'display': 'text-[32px] leading-tight font-bold',
        'large_title': 'text-[28px] leading-tight font-bold',
        'title': 'text-[22px] leading-snug font-semibold',
        'headline': 'text-[17px] leading-normal font-semibold',
        'subheadline': 'text-[15px] leading-normal font-medium',
        'body': 'text-[15px] leading-normal',
        'caption': 'text-[13px] leading-normal text-muted-foreground'
    };
    const colorMap: Record<string, string> = {
        'default': 'text-gray-900',
        'muted': 'text-gray-500',
        'disabled': 'text-gray-400',
        'primary': 'text-[#00A884]',
        'success': 'text-green-600',
        'danger': 'text-red-500',
        'warning': 'text-yellow-600'
    };

    const alignClass = alignMap[component['text-align']] || 'text-left';
    const sizeClass = sizeMap[component['font-size']] || sizeMap['body'];
    const colorClass = colorMap[component.color] || 'text-gray-900';
    const weightClass = component['font-weight'] === 'bold' ? 'font-bold' :
        component['font-weight'] === 'medium' ? 'font-medium' :
            component['font-weight'] === 'light' ? 'font-light' : '';
    const italicClass = component['font-style'] === 'italic' ? 'italic' : '';

    return (
        <div className={cn(alignClass, sizeClass, colorClass, weightClass, italicClass, "mb-2")}>
            {component.text}
        </div>
    );
};

const InputRenderer = ({ component, formData, setFormData }: FlowComponentProps) => {
    const name = component.name;
    const value = formData[name] || '';
    const isRequired = component.required;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [name]: e.target.value }));
    };

    return (
        <div className="mb-4">
            <Label className="text-xs font-normal text-gray-500 mb-1 block">
                {component.label} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Input
                type={component['input-type'] || 'text'}
                value={value}
                onChange={handleChange}
                placeholder={component.placeholder}
                className="bg-white border-gray-300 focus-visible:ring-[#00A884] h-12 text-[15px]"
                required={isRequired}
            />
            {component['helper-text'] && (
                <p className="text-xs text-gray-500 mt-1">{component['helper-text']}</p>
            )}
        </div>
    );
};

const GenericRenderer = ({ component }: { component: any }) => (
    <div className="p-2 border border-dashed border-gray-300 rounded text-xs text-gray-400 text-center mb-2">
        Component: {component.type}
    </div>
);

const FlowComponent = (props: FlowComponentProps) => {
    const { component } = props;
    switch (component.type) {
        case 'Text': return <TextRenderer component={component} />;
        case 'TextInput': return <InputRenderer {...props} />;
        // Fallback or Legacy
        case 'TextHeading': return <h2 className="text-lg font-bold mb-2">{component.text}</h2>;
        case 'TextBody': return <p className="text-sm mb-2 text-gray-700">{component.text}</p>;
        case 'Footer': return null; // Rendered separately
        default: return <GenericRenderer component={component} />;
    }
};

// --- Main Preview Component ---

export const MetaFlowPreview = ({
    flowJson,
    activeScreenId,
    className
}: {
    flowJson: string,
    activeScreenId?: string | null,
    className?: string
}) => {
    const [flowData, setFlowData] = useState<any>(null);
    const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [currentTime, setCurrentTime] = useState("");

    // Clock
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        };
        updateTime();
        const timer = setInterval(updateTime, 60000);
        return () => clearInterval(timer);
    }, []);

    // Parse Data
    useEffect(() => {
        try {
            if (flowJson) {
                const parsed = JSON.parse(flowJson);
                setFlowData(parsed);
                if (!currentScreenId || !parsed.screens?.some((s: any) => s.id === currentScreenId)) {
                    setCurrentScreenId(parsed.screens?.[0]?.id);
                }
            }
        } catch (e) {
            console.error("Invalid JSON", e);
        }
    }, [flowJson, currentScreenId]);

    // Update active screen from props
    useEffect(() => {
        if (activeScreenId) setCurrentScreenId(activeScreenId);
    }, [activeScreenId]);

    if (!flowData) return <div className="flex items-center justify-center h-full text-xs text-gray-400">Loading Preview...</div>;

    const currentScreen = flowData.screens?.find((s: any) => s.id === currentScreenId);
    if (!currentScreen) return <div className="flex items-center justify-center h-full text-xs text-red-400">Screen not found</div>;

    // Extract Children
    const layout = currentScreen.layout;
    const safeChildren = layout?.children?.filter(Boolean) || [];
    // Handle both direct children (legacy/simple) and Form wrapper
    let renderableComponents: any[] = [];

    // Find Form or NavigationList if it exists
    const container = safeChildren.find((c: any) => c.type === 'Form' || c.type === 'NavigationList');

    if (container) {
        renderableComponents = container.children || [];
    } else {
        renderableComponents = safeChildren;
    }

    const footerComponent = renderableComponents.find((c: any) => c.type === 'Footer');
    const mainComponents = renderableComponents.filter((c: any) => c.type !== 'Footer');

    return (
        <div className={cn(
            "relative bg-[#ECE5DD] flex flex-col overflow-hidden font-sans select-none",
            className
        )}
            style={{
                backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d936cd0f1d.png')",
                backgroundBlendMode: "overlay"
            }}
        >
            {/* --- Status Bar --- */}
            <div className="h-[44px] bg-[#F0F2F5] flex items-center justify-between px-6 text-black z-30 flex-shrink-0">
                <span className="text-[15px] font-semibold">{currentTime}</span>
                <div className="flex items-center gap-1.5">
                    <Signal className="w-4 h-4 fill-black" />
                    <Wifi className="w-4 h-4" />
                    <Battery className="w-[18px] h-[10px]" />
                </div>
            </div>

            {/* --- WhatsApp Header --- */}
            <div className="h-[60px] bg-[#F0F2F5] flex items-center px-2 shadow-sm z-20 flex-shrink-0 border-b border-[#e2e2e2]">
                <Button variant="ghost" size="icon" className="text-[#007AFF] -mr-1">
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <div className="text-[#007AFF] text-[17px] mr-1">2</div>

                <div className="flex items-center ml-1 flex-1">
                    <Avatar className="w-[36px] h-[36px] mr-2">
                        <AvatarImage src="https://github.com/shadcn.png" />
                        <AvatarFallback>B</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-[16px] font-semibold leading-none text-black">Business Name</span>
                        <span className="text-[11px] text-gray-500 leading-none mt-1">Official business account</span>
                    </div>
                </div>
            </div>

            {/* --- Chat Content (Start Button) --- */}
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
                {/* Date Bubble */}
                <div className="bg-[#DDDDE4] rounded-[8px] px-3 py-1 shadow-sm mb-6 mt-4">
                    <span className="text-[12px] text-gray-600 font-medium">TODAY</span>
                </div>

                {/* Encryption Message */}
                <div className="bg-[#FEF9C3] rounded-[8px] px-4 py-2 shadow-sm mb-6 max-w-[85%] text-center">
                    <span className="text-[12px] text-gray-600">
                        🔒 Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
                    </span>
                </div>

                {/* Simulated Business Message */}
                <div className="self-start bg-white rounded-tr-lg rounded-br-lg rounded-bl-lg max-w-[85%] shadow-sm relative p-1 mb-2">
                    <div className="p-2 pb-6">
                        <p className="text-[15px] text-black leading-snug">
                            Hello! 👋 Click below to start the experience.
                        </p>
                    </div>
                    {/* Time */}
                    <span className="absolute bottom-1 right-2 text-[11px] text-gray-400 min-w-[30px] text-right">
                        {currentTime}
                    </span>
                </div>

                {/* CTA Button (Simulated) */}
                <div className="self-start w-[85%]">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden flex items-center justify-center p-2 cursor-pointer hover:bg-gray-50 transition-colors">
                        <span className="text-[#00A884] font-medium text-[15px]">View Flow</span>
                    </div>
                </div>

            </div>

            {/* --- Bottom Bar --- */}
            <div className="h-[80px] bg-[#F0F2F5] flex items-center px-4 flex-shrink-0">
                <div className="flex-1 bg-white h-[40px] rounded-full border border-gray-300 flex items-center px-4 text-gray-400 text-[15px]">
                    Message...
                </div>
            </div>


            {/* --- FLOW MODAL (Full Screen) --- */}
            <div className="absolute inset-0 z-50 flex flex-col bg-white animate-in slide-in-from-bottom duration-300">
                {/* Flow Header */}
                <div className="h-[56px] flex items-center justify-between px-2 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" className="text-gray-900" onClick={() => { }}>
                            <X className="w-6 h-6" />
                        </Button>
                        <span className="text-[17px] font-semibold ml-2 text-gray-900">
                            {currentScreen.title || "Flow"}
                        </span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-gray-900">
                        <MoreVertical className="w-5 h-5" />
                    </Button>
                </div>

                {/* Flow Body */}
                <ScrollArea className="flex-1 bg-white">
                    <div className="p-4 flex flex-col gap-2">
                        {mainComponents.map((comp: any, i: number) => (
                            <FlowComponent
                                key={comp.name || i}
                                component={comp}
                                formData={formData}
                                setFormData={setFormData}
                            />
                        ))}
                    </div>
                </ScrollArea>

                {/* Flow Footer */}
                {footerComponent && (
                    <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-white">
                        <div className="flex flex-col gap-3">
                            <Button
                                className="w-full h-[44px] bg-[#00A884] hover:bg-[#008f6f] text-white font-semibold text-[15px] rounded-full shadow-none"
                            >
                                {footerComponent.label || "Continue"}
                            </Button>
                            {/* Meta Branding */}
                            <div className="flex items-center justify-center gap-1 opacity-60">
                                <span className="text-[10px] text-gray-500">Secured by</span>
                                <span className="text-[10px] font-bold text-gray-600">Meta</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
