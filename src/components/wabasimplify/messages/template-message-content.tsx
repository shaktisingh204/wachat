
'use client';

import { FileText, Link as LinkIcon, Phone } from "lucide-react";
import React from "react";

export function TemplateMessageContent({ content }: { content: any }) {
    const { name, components } = content || {};

    const header = components?.find((c: any) => c.type === 'HEADER');
    const body = components?.find((c: any) => c.type === 'BODY');
    const footer = components?.find((c: any) => c.type === 'FOOTER');
    // For sent templates, CTA buttons are part of the 'BUTTONS' component array
    const buttonsComp = components?.find((c: any) => c.type === 'BUTTONS');
    const buttons = buttonsComp?.buttons || [];

    const renderTextWithVariables = (text?: string, params?: { type: string, text: string }[]) => {
        if (!text) return null;
        if (!params || params.length === 0) return text;

        let replacedText = text;
        params.forEach((param, index) => {
            const placeholder = `{{${index + 1}}}`;
            if (param.type === 'text') {
                replacedText = replacedText.replace(placeholder, param.text);
            }
        });
        return replacedText;
    };
    
    const bodyTextWithParams = body ? renderTextWithVariables(body.text, body.parameters) : '';

    return (
        <div className="space-y-2 w-64">
            <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                <FileText className="h-4 w-4" />
                <span>Template: {name}</span>
            </div>
            {header && (
                <div className="font-bold border-b border-black/10 pb-2">
                    {header.parameters && header.parameters[0].type === 'text' 
                        ? header.parameters[0].text 
                        : header.format || 'Media Header'}
                </div>
            )}
            {bodyTextWithParams && (
                <p className="whitespace-pre-wrap">{bodyTextWithParams}</p>
            )}
            {footer && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-black/10">{footer.text}</p>
            )}
            {buttons && buttons.length > 0 && (
                 <div className="mt-2 pt-2 border-t border-black/10 space-y-1">
                    {buttons.map((button: any, index: number) => {
                        const getButtonIcon = () => {
                            if (button.type === 'URL') return <LinkIcon className="h-4 w-4 mr-2" />;
                            if (button.type === 'PHONE_NUMBER') return <Phone className="h-4 w-4 mr-2" />;
                            return null;
                        }
                        return (
                             <div key={index} className="text-center bg-white/80 dark:bg-muted/50 rounded-md py-1.5 text-sm font-medium text-blue-500 border flex items-center justify-center">
                                {getButtonIcon()}
                                {button.text}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
