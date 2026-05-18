
'use client';

import { useState, useMemo, useActionState, useEffect } from 'react';
import type { WithId, Project } from '@/lib/definitions';
import { ZoruCard, ZoruCardContent, ZoruCardDescription, ZoruCardFooter, ZoruCardHeader, ZoruCardTitle, ZoruButton } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { Code, Save, LoaderCircle, Palette, Text, MessageSquare, Code2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from './custom-sidebar-components';
import { ZoruAvatar, ZoruAvatarImage, ZoruAvatarFallback } from '../ui/avatar';
import { CodeBlock } from './code-block';
import { ZoruSeparator } from '../ui/separator';
import { Slider } from '../ui/slider';
import { ColorPicker } from '../ui/color-picker';
import { saveWidgetSettings } from '@/app/actions/widget.actions';
import { useFormStatus } from 'react-dom';
import Image from 'next/image';
import { SabFilePickerButton } from '@/components/sabfiles';
import { Upload } from 'lucide-react';

interface WhatsAppWidgetGeneratorProps {
    project: WithId<Project>;
}

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Widget Settings
        </ZoruButton>
    )
}

export function WhatsAppWidgetGenerator({ project }: WhatsAppWidgetGeneratorProps) {
    const [state, formAction] = useActionState(saveWidgetSettings, initialState);
    const { toast } = useToast();
    const [showWidget, setShowWidget] = useState(false);

    // --- Form State ---
    const [settings, setSettings] = useState(() => ({
        phoneNumber: project.widgetSettings?.phoneNumber || project.phoneNumbers?.[0]?.display_phone_number || '',
        prefilledMessage: project.widgetSettings?.prefilledMessage || 'Hello, I have a question.',
        position: project.widgetSettings?.position || 'bottom-right',
        buttonColor: project.widgetSettings?.buttonColor || '#25D366',
        headerTitle: project.widgetSettings?.headerTitle || project.name,
        headerSubtitle: project.widgetSettings?.headerSubtitle || 'Typically replies within minutes',
        headerAvatarUrl: project.widgetSettings?.headerAvatarUrl || project.phoneNumbers?.[0]?.profile?.profile_picture_url || '',
        welcomeMessage: project.widgetSettings?.welcomeMessage || 'Welcome! How can we help you?',
        ctaText: project.widgetSettings?.ctaText || 'Start Chat',
        borderRadius: project.widgetSettings?.borderRadius ?? 10,
        padding: project.widgetSettings?.padding ?? 16,
        textColor: project.widgetSettings?.textColor || '#111827',
        buttonTextColor: project.widgetSettings?.buttonTextColor || '#FFFFFF',
    }));

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    const handleSettingChange = (field: keyof typeof settings, value: string | number | boolean) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    }


    const embedCode = useMemo(() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        return `<script src="${appUrl}/api/widget/${project._id.toString()}" async defer></script>`;
    }, [project._id]);

    return (
        <ZoruCard className="card-gradient card-gradient-blue">
            <form action={formAction}>
                <input type="hidden" name="projectId" value={project._id.toString()} />
                <input type="hidden" name="phoneNumber" value={settings.phoneNumber} />
                <input type="hidden" name="prefilledMessage" value={settings.prefilledMessage} />
                <input type="hidden" name="position" value={settings.position} />
                <input type="hidden" name="buttonColor" value={settings.buttonColor} />
                <input type="hidden" name="headerTitle" value={settings.headerTitle} />
                <input type="hidden" name="headerSubtitle" value={settings.headerSubtitle} />
                <input type="hidden" name="headerAvatarUrl" value={settings.headerAvatarUrl} />
                <input type="hidden" name="welcomeMessage" value={settings.welcomeMessage} />
                <input type="hidden" name="ctaText" value={settings.ctaText} />
                <input type="hidden" name="borderRadius" value={settings.borderRadius} />
                <input type="hidden" name="padding" value={settings.padding} />
                <input type="hidden" name="textColor" value={settings.textColor} />
                <input type="hidden" name="buttonTextColor" value={settings.buttonTextColor} />

                <ZoruCardHeader>
                    <div className="flex items-center gap-3">
                        <Code className="h-8 w-8" />
                        <div>
                            <ZoruCardTitle>WhatsApp Widget Generator</ZoruCardTitle>
                            <ZoruCardDescription>Create a customizable chat widget to embed on your website.</ZoruCardDescription>
                        </div>
                    </div>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid lg:grid-cols-2 gap-8 items-start">
                        {/* Customization Panel */}
                        <div className="space-y-4">
                            <ZoruCard>
                                <ZoruCardHeader><ZoruCardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Content</ZoruCardTitle></ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="space-y-2"><ZoruLabel>Phone Number</ZoruLabel><ZoruSelect value={settings.phoneNumber} onValueChange={(v) => handleSettingChange('phoneNumber', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent>{project.phoneNumbers.map(phone => (<ZoruSelectItem key={phone.id} value={phone.display_phone_number}>{phone.display_phone_number}</ZoruSelectItem>))}</ZoruSelectContent></ZoruSelect></div>
                                    <div className="space-y-2"><ZoruLabel>Welcome Message</ZoruLabel><ZoruTextarea value={settings.welcomeMessage} onChange={e => handleSettingChange('welcomeMessage', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>Pre-filled User Message</ZoruLabel><ZoruTextarea value={settings.prefilledMessage} onChange={e => handleSettingChange('prefilledMessage', e.target.value)} /></div>
                                </ZoruCardContent>
                            </ZoruCard>
                            <ZoruCard>
                                <ZoruCardHeader><ZoruCardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Appearance</ZoruCardTitle></ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><ZoruLabel>Position</ZoruLabel><ZoruSelect value={settings.position} onValueChange={(v) => handleSettingChange('position', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="bottom-right">Bottom Right</ZoruSelectItem><ZoruSelectItem value="bottom-left">Bottom Left</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                        <div className="space-y-2"><ZoruLabel htmlFor="widget-color">Widget Color</ZoruLabel><ColorPicker id="widget-color" value={settings.buttonColor} onChange={v => handleSettingChange('buttonColor', v)} /></div>
                                    </div>
                                    <div className="space-y-2"><ZoruLabel>Header Title</ZoruLabel><ZoruInput value={settings.headerTitle} onChange={e => handleSettingChange('headerTitle', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>Header Subtitle</ZoruLabel><ZoruInput value={settings.headerSubtitle} onChange={e => handleSettingChange('headerSubtitle', e.target.value)} /></div>
                                    <div className="space-y-2">
                                        <ZoruLabel>ZoruAvatar URL or Upload</ZoruLabel>
                                        <ZoruInput placeholder="https://..." value={settings.headerAvatarUrl} onChange={e => handleSettingChange('headerAvatarUrl', e.target.value)} />
                                        <SabFilePickerButton
                                            accept="image"
                                            onPick={({ url }) => handleSettingChange('headerAvatarUrl', url)}
                                        >
                                            <Upload className="h-4 w-4" /> Choose file
                                        </SabFilePickerButton>
                                    </div>
                                    <div className="space-y-2"><ZoruLabel>CTA Text</ZoruLabel><ZoruInput value={settings.ctaText} onChange={e => handleSettingChange('ctaText', e.target.value)} /></div>
                                    <ZoruSeparator />
                                    <div className="space-y-2"><ZoruLabel>Border Radius ({settings.borderRadius}px)</ZoruLabel><Slider value={[settings.borderRadius]} onValueChange={v => handleSettingChange('borderRadius', v[0])} min={0} max={50} /></div>
                                    <div className="space-y-2"><ZoruLabel>Padding ({settings.padding}px)</ZoruLabel><Slider value={[settings.padding]} onValueChange={v => handleSettingChange('padding', v[0])} min={8} max={32} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><ZoruLabel htmlFor="text-color">Text Color</ZoruLabel><ColorPicker id="text-color" value={settings.textColor} onChange={v => handleSettingChange('textColor', v)} /></div>
                                        <div className="space-y-2"><ZoruLabel htmlFor="button-text-color">ZoruButton Text Color</ZoruLabel><ColorPicker id="button-text-color" value={settings.buttonTextColor} onChange={v => handleSettingChange('buttonTextColor', v)} /></div>
                                    </div>
                                </ZoruCardContent>
                            </ZoruCard>
                        </div>
                        {/* Preview and Code Panel */}
                        <div className="space-y-4">
                            <ZoruLabel>Live Preview</ZoruLabel>
                            <div className="relative h-[500px] bg-muted rounded-lg overflow-hidden flex items-end" style={{ [settings.position.includes('right') ? 'justifyContent' : '']: settings.position.includes('right') ? 'flex-end' : 'flex-start', padding: '20px' }}>
                                <div id="sabnode-widget-container-preview" className="static">
                                    <ZoruButton
                                        id="sabnode-widget-button-preview"
                                        style={{ backgroundColor: settings.buttonColor }}
                                        onClick={() => {
                                            setShowWidget(!showWidget);
                                            toast({ title: 'Widget Saved', description: 'Widget is saved' });
                                        }}
                                        className="relative h-16 w-16"
                                    >
                                        <WhatsAppIcon className="h-8 w-8" style={{ color: settings.buttonTextColor }} />
                                    </ZoruButton>
                                    {showWidget && (
                                        <div id="sabnode-widget-chatbox-preview" className="absolute" style={{ bottom: '96px', right: '0', width: '350px', backgroundColor: 'white', borderRadius: `${settings.borderRadius}px`, overflow: 'hidden', boxShadow: '0 5px 20px rgba(0,0,0,0.2)' }}>
                                            <div className="sabnode-chat-header" style={{ backgroundColor: settings.buttonColor, color: settings.buttonTextColor, padding: `${settings.padding}px`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <ZoruAvatar className="w-10 h-10">
                                                    {settings.headerAvatarUrl && <ZoruAvatarImage src={settings.headerAvatarUrl} />}
                                                    <ZoruAvatarFallback>{settings.headerTitle.charAt(0)}</ZoruAvatarFallback>
                                                </ZoruAvatar>
                                                <div><div className="title font-bold">{settings.headerTitle}</div><div className="subtitle text-xs opacity-90">{settings.headerSubtitle}</div></div>
                                            </div>
                                            <div className="sabnode-chat-body" style={{ padding: `${settings.padding}px`, backgroundColor: '#E5DDD5' }}>
                                                <div className="sabnode-welcome-msg" style={{ background: 'white', color: settings.textColor, padding: '12px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{settings.welcomeMessage}</div>
                                            </div>
                                            <div className="sabnode-chat-footer" style={{ padding: `${settings.padding}px`, background: '#f9f9f9', borderTop: '1px solid #eee' }}>
                                                <ZoruButton
                                                    className="sabnode-cta-button w-full h-12 rounded-full"
                                                    style={{ backgroundColor: settings.buttonColor, color: settings.buttonTextColor }}
                                                    onClick={() => toast({ title: 'Widget Saved', description: 'Widget is saved' })}
                                                >
                                                    <WhatsAppIcon className="h-4 w-4 mr-2" />
                                                    {settings.ctaText}
                                                </ZoruButton>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Embed Code</ZoruLabel>
                                <p className="text-xs text-muted-foreground">Copy this single line of code and paste it before the closing `&lt;/body&gt;` tag on your website.</p>
                                <CodeBlock code={embedCode} />
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </form>
        </ZoruCard>
    );
}
