
'use client';

import { FileText, Link as LinkIcon, Phone, Video, Image as ImageIcon, File, Ticket, Calendar, Gift, ShoppingCart, View } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import CountdownTimer from "../countdown-timer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function TemplateMessageContent({ content }: { content: any }) {
    const { name, components = [] } = content || {};

    const header = components.find((c: any) => c.type === 'HEADER');
    const body = components.find((c: any) => c.type === 'BODY');
    const footer = components.find((c: any) => c.type === 'FOOTER');
    const buttonsComp = components.find((c: any) => c.type === 'BUTTONS');
    const buttons = buttonsComp?.buttons || [];
    const carouselComp = components.find((c: any) => c.type === 'CAROUSEL');
    const ltoComp = components.find((c: any) => c.type === 'LIMITED_TIME_OFFER');

    const renderTextWithVariables = (text?: string, params?: { type: string, text: string }[]) => {
        if (!text) return null;
        if (!params || params.length === 0) return text;

        let replacedText = text;
        params.forEach((param, index) => {
            const placeholder = new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g');
            if (param.type === 'text') {
                replacedText = replacedText.replace(placeholder, param.text);
            }
        });
        return replacedText;
    };
    
    const bodyTextWithParams = body ? renderTextWithVariables(body.text, body.parameters) : '';

    const renderHeader = () => {
        if (!header) return null;
        if (header.format === 'TEXT') {
             return <h3 className="font-bold text-lg mb-2">{renderTextWithVariables(header.text, header.parameters)}</h3>;
        }
        if (header.format === 'IMAGE') {
            return <div className="aspect-video bg-gray-200 rounded-t-lg flex items-center justify-center text-gray-400"><ImageIcon className="h-10 w-10"/></div>;
        }
        if (header.format === 'VIDEO') {
            return <div className="aspect-video bg-gray-200 rounded-t-lg flex items-center justify-center text-gray-400"><Video className="h-10 w-10"/></div>;
        }
        if (header.format === 'DOCUMENT') {
            return <div className="p-4 bg-gray-200 rounded-t-lg flex items-center justify-center text-gray-400"><File className="h-10 w-10"/></div>;
        }
        return null;
    }

    if (isMarketingCarousel) {
        return (
            <div className="w-64">
                <Card className="shadow-none border-0 bg-transparent">
                    <CardHeader className="p-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-2"><View className="h-4 w-4"/> Carousel Sent</CardTitle></CardHeader>
                    <CardContent className="p-2">
                        <p className="text-sm italic">Sent a carousel with {carouselComp.cards.length} cards.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (ltoComp) {
        return (
             <div className="w-64">
                <Card className="shadow-none border-0 bg-transparent">
                    <CardHeader className="p-2 flex flex-row items-center gap-2">
                        <Gift className="h-5 w-5 text-primary"/>
                        <CardTitle className="text-base">Limited-Time Offer</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                        {renderHeader()}
                        <p className="py-2 text-sm">{bodyTextWithParams}</p>
                        <div className="bg-red-500 text-white p-2 rounded-md text-center">
                            <p className="font-bold text-lg">Offer Ends In:</p>
                            <CountdownTimer targetDate={new Date(ltoComp.expiration.timestamp * 1000).toISOString()} />
                        </div>
                         {ltoComp.coupon_code && <p className="text-center font-mono text-xs mt-2 bg-gray-200 p-1 rounded">Code: {ltoComp.coupon_code}</p>}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-2 w-64">
            <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                <FileText className="h-4 w-4" />
                <span>Template: {name}</span>
            </div>
            
            {renderHeader()}
            
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
