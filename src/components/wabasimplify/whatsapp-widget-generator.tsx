

'use client';

import { useState, useMemo, useActionState, useEffect } from 'react';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Code, Save, LoaderCircle, Palette, Text, MessageSquare, Code2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from './custom-sidebar-components';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { CodeBlock } from './code-block';
import { Separator } from '../ui/separator';
import { Slider } from '../ui/slider';
import { saveWidgetSettings } from '@/app/actions/integrations.actions';
import { useFormStatus } from 'react-dom';
import Image from 'next/image';

interface WhatsAppWidgetGeneratorProps {
  project: WithId<Project>;
}

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Widget Settings
        </Button>
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
        setSettings(prev => ({...prev, [field]: value}));
    }

    const handleFileChange = (file: File | null) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            handleSettingChange('headerAvatarUrl', reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const embedCode = useMemo(() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        return `<script src="${appUrl}/api/widget/${project._id.toString()}" async defer></script>`;
    }, [project._id]);
    
    return (
        <Card className="card-gradient card-gradient-blue">
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

                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Code className="h-8 w-8" />
                        <div>
                            <CardTitle>WhatsApp Widget Generator</CardTitle>
                            <CardDescription>Create a customizable chat widget to embed on your website.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid lg:grid-cols-2 gap-8 items-start">
                        {/* Customization Panel */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/>Content</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="space-y-2"><Label>Phone Number</Label><Select value={settings.phoneNumber} onValueChange={(v) => handleSettingChange('phoneNumber', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{project.phoneNumbers.map(phone => (<SelectItem key={phone.id} value={phone.display_phone_number}>{phone.display_phone_number}</SelectItem>))}</SelectContent></Select></div>
                                     <div className="space-y-2"><Label>Welcome Message</Label><Textarea value={settings.welcomeMessage} onChange={e => handleSettingChange('welcomeMessage', e.target.value)} /></div>
                                     <div className="space-y-2"><Label>Pre-filled User Message</Label><Textarea value={settings.prefilledMessage} onChange={e => handleSettingChange('prefilledMessage', e.target.value)} /></div>
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5"/>Appearance</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Position</Label><Select value={settings.position} onValueChange={(v) => handleSettingChange('position', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bottom-right">Bottom Right</SelectItem><SelectItem value="bottom-left">Bottom Left</SelectItem></SelectContent></Select></div>
                                        <div className="space-y-2"><Label>Widget Color</Label><Input type="color" value={settings.buttonColor} onChange={e => handleSettingChange('buttonColor', e.target.value)} /></div>
                                    </div>
                                    <div className="space-y-2"><Label>Header Title</Label><Input value={settings.headerTitle} onChange={e => handleSettingChange('headerTitle', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Header Subtitle</Label><Input value={settings.headerSubtitle} onChange={e => handleSettingChange('headerSubtitle', e.target.value)} /></div>
                                    <div className="space-y-2">
                                        <Label>Avatar URL or Upload</Label>
                                        <Input placeholder="https://..." value={settings.headerAvatarUrl} onChange={e => handleSettingChange('headerAvatarUrl', e.target.value)} />
                                        <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} className="text-xs" />
                                    </div>
                                    <div className="space-y-2"><Label>CTA Text</Label><Input value={settings.ctaText} onChange={e => handleSettingChange('ctaText', e.target.value)} /></div>
                                     <Separator />
                                    <div className="space-y-2"><Label>Border Radius ({settings.borderRadius}px)</Label><Slider value={[settings.borderRadius]} onValueChange={v => handleSettingChange('borderRadius', v[0])} min={0} max={50}/></div>
                                    <div className="space-y-2"><Label>Padding ({settings.padding}px)</Label><Slider value={[settings.padding]} onValueChange={v => handleSettingChange('padding', v[0])} min={8} max={32}/></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.textColor} onChange={e => handleSettingChange('textColor', e.target.value)} /></div>
                                        <div className="space-y-2"><Label>Button Text Color</Label><Input type="color" value={settings.buttonTextColor} onChange={e => handleSettingChange('buttonTextColor', e.target.value)} /></div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        {/* Preview and Code Panel */}
                        <div className="space-y-4">
                            <Label>Live Preview</Label>
                            <div className="relative h-[500px] bg-muted rounded-lg overflow-hidden flex items-end" style={{ [settings.position.includes('right') ? 'justifyContent' : '']: settings.position.includes('right') ? 'flex-end' : 'flex-start', padding: '20px' }}>
                                <div id="sabnode-widget-container-preview" className="static">
                                    <Button id="sabnode-widget-button-preview" style={{ backgroundColor: settings.buttonColor }} onClick={() => setShowWidget(!showWidget)} className="relative h-16 w-16">
                                        <WhatsAppIcon className="h-8 w-8" style={{color: settings.buttonTextColor}} />
                                    </Button>
                                    {showWidget && (
                                         <div id="sabnode-widget-chatbox-preview" className="absolute" style={{ bottom: '96px', right: '0', width: '350px', backgroundColor: 'white', borderRadius: `${settings.borderRadius}px`, overflow: 'hidden', boxShadow: '0 5px 20px rgba(0,0,0,0.2)'}}>
                                            <div className="sabnode-chat-header" style={{backgroundColor: settings.buttonColor, color: settings.buttonTextColor, padding: `${settings.padding}px`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Avatar className="w-10 h-10">
                                                    {settings.headerAvatarUrl && <AvatarImage src={settings.headerAvatarUrl} />}
                                                    <AvatarFallback>{settings.headerTitle.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div><div className="title font-bold">{settings.headerTitle}</div><div className="subtitle text-xs opacity-90">{settings.headerSubtitle}</div></div>
                                            </div>
                                            <div className="sabnode-chat-body" style={{ padding: `${settings.padding}px`, backgroundColor: '#E5DDD5' }}>
                                                <div className="sabnode-welcome-msg" style={{ background: 'white', color: settings.textColor, padding: '12px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'}}>{settings.welcomeMessage}</div>
                                            </div>
                                            <div className="sabnode-chat-footer" style={{ padding: `${settings.padding}px`, background: '#f9f9f9', borderTop: '1px solid #eee'}}>
                                                <Button className="sabnode-cta-button w-full h-12 rounded-full" style={{backgroundColor: settings.buttonColor, color: settings.buttonTextColor}}>
                                                    <WhatsAppIcon className="h-4 w-4 mr-2"/>
                                                    {settings.ctaText}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                 <Label>Embed Code</Label>
                                 <p className="text-xs text-muted-foreground">Copy this single line of code and paste it before the closing `&lt;/body&gt;` tag on your website.</p>
                                 <CodeBlock code={embedCode} />
                            </div>
                        </div>
                    </div>
                </CardContent>
                 <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}
