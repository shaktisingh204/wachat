'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Label,
  Input,
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Avatar,
  ZoruAvatarImage,
  ZoruAvatarFallback,
  Separator,
  Switch,
} from '@/components/zoruui';
import {
  useState,
  useMemo,
  useActionState,
  useEffect } from 'react';
import type { WithId,
  Project } from '@/lib/definitions';
import { Code, Save, LoaderCircle, Palette, Text, MessageSquare, Code2, Settings, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from './custom-sidebar-components';
import { CodeBlock } from './code-block';

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
        setSettings(prev => ({ ...prev, [field]: value }));
    }

    // --- Advanced Settings (Local State for Embed Code only) ---
    const [advancedSettings, setAdvancedSettings] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`widget_adv_${project._id}`);
            if (saved) return JSON.parse(saved);
        }
        return { autoOpenDelay: 0, abTestEnabled: false, styleVariant: 'classic' };
    });

    useEffect(() => {
        localStorage.setItem(`widget_adv_${project._id}`, JSON.stringify(advancedSettings));
    }, [advancedSettings, project._id]);

    const handleAdvancedSettingChange = (field: keyof typeof advancedSettings, value: string | number | boolean) => {
        setAdvancedSettings((prev: any) => ({ ...prev, [field]: value }));
    }

    const embedCode = useMemo(() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        let attrs = "";
        if (advancedSettings.autoOpenDelay > 0) attrs += ` data-auto-open="${advancedSettings.autoOpenDelay}"`;
        if (advancedSettings.abTestEnabled) attrs += ` data-ab-test="true"`;
        if (advancedSettings.styleVariant && advancedSettings.styleVariant !== 'classic') attrs += ` data-style="${advancedSettings.styleVariant}"`;
        return `<script src="${appUrl}/api/widget/${project._id.toString()}"${attrs} async defer></script>`;
    }, [project._id, advancedSettings]);

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
                            <Card>
                                <ZoruCardHeader><ZoruCardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Content</ZoruCardTitle></ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="space-y-2"><Label>Phone Number</Label><Select value={settings.phoneNumber} onValueChange={(v) => handleSettingChange('phoneNumber', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent>{project.phoneNumbers.map(phone => (<ZoruSelectItem key={phone.id} value={phone.display_phone_number}>{phone.display_phone_number}</ZoruSelectItem>))}</ZoruSelectContent></Select></div>
                                    <div className="space-y-2"><Label>Welcome Message</Label><Textarea value={settings.welcomeMessage} onChange={e => handleSettingChange('welcomeMessage', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Pre-filled User Message</Label><Textarea value={settings.prefilledMessage} onChange={e => handleSettingChange('prefilledMessage', e.target.value)} /></div>
                                </ZoruCardContent>
                            </Card>
                            <Card>
                                <ZoruCardHeader><ZoruCardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />Appearance</ZoruCardTitle></ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Position</Label><Select value={settings.position} onValueChange={(v) => handleSettingChange('position', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="bottom-right">Bottom Right</ZoruSelectItem><ZoruSelectItem value="bottom-left">Bottom Left</ZoruSelectItem></ZoruSelectContent></Select></div>
                                        <div className="space-y-2"><Label htmlFor="widget-color">Widget Color</Label><ColorPicker id="widget-color" value={settings.buttonColor} onChange={v => handleSettingChange('buttonColor', v)} /></div>
                                    </div>
                                    <div className="space-y-2"><Label>Header Title</Label><Input value={settings.headerTitle} onChange={e => handleSettingChange('headerTitle', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Header Subtitle</Label><Input value={settings.headerSubtitle} onChange={e => handleSettingChange('headerSubtitle', e.target.value)} /></div>
                                    <div className="space-y-2">
                                        <Label>Avatar URL or Upload</Label>
                                        <Input placeholder="https://..." value={settings.headerAvatarUrl} onChange={e => handleSettingChange('headerAvatarUrl', e.target.value)} />
                                        <SabFilePickerButton
                                            accept="image"
                                            onPick={({ url }) => handleSettingChange('headerAvatarUrl', url)}
                                        >
                                            <Upload className="h-4 w-4" /> Choose file
                                        </SabFilePickerButton>
                                    </div>
                                    <div className="space-y-2"><Label>CTA Text</Label><Input value={settings.ctaText} onChange={e => handleSettingChange('ctaText', e.target.value)} /></div>
                                    <Separator />
                                    <div className="space-y-2"><Label>Border Radius ({settings.borderRadius}px)</Label><Slider value={[settings.borderRadius]} onValueChange={v => handleSettingChange('borderRadius', v[0])} min={0} max={50} /></div>
                                    <div className="space-y-2"><Label>Padding ({settings.padding}px)</Label><Slider value={[settings.padding]} onValueChange={v => handleSettingChange('padding', v[0])} min={8} max={32} /></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label htmlFor="text-color">Text Color</Label><ColorPicker id="text-color" value={settings.textColor} onChange={v => handleSettingChange('textColor', v)} /></div>
                                        <div className="space-y-2"><Label htmlFor="button-text-color">Button Text Color</Label><ColorPicker id="button-text-color" value={settings.buttonTextColor} onChange={v => handleSettingChange('buttonTextColor', v)} /></div>
                                    </div>
                                </ZoruCardContent>
                            </Card>
                            <Card>
                                <ZoruCardHeader><ZoruCardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Behavior & Testing</ZoruCardTitle></ZoruCardHeader>
                                <ZoruCardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Auto-Open Delay (seconds)</Label>
                                        <Input type="number" min="0" value={advancedSettings.autoOpenDelay} onChange={e => handleAdvancedSettingChange('autoOpenDelay', parseInt(e.target.value) || 0)} placeholder="0 for disabled" />
                                        <p className="text-xs text-muted-foreground">Set to 0 to disable auto-open. (e.g. 5 means open after 5 seconds)</p>
                                    </div>
                                    <Separator />
                                    <div className="space-y-2 flex items-center justify-between">
                                        <div>
                                            <Label>A/B Test Variants</Label>
                                            <p className="text-xs text-muted-foreground">Test classic vs alternative widget styles on your site</p>
                                        </div>
                                        <Switch checked={advancedSettings.abTestEnabled} onCheckedChange={v => handleAdvancedSettingChange('abTestEnabled', v)} />
                                    </div>
                                    {advancedSettings.abTestEnabled && (
                                        <div className="space-y-2">
                                            <Label>Style Variant to Preview</Label>
                                            <Select value={advancedSettings.styleVariant} onValueChange={(v) => handleAdvancedSettingChange('styleVariant', v)}>
                                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    <ZoruSelectItem value="classic">Classic</ZoruSelectItem>
                                                    <ZoruSelectItem value="modern">Modern (Floating Box)</ZoruSelectItem>
                                                </ZoruSelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </ZoruCardContent>
                            </Card>
                        </div>
                        {/* Preview and Code Panel */}
                        <div className="space-y-4">
                            <Label>Live Preview</Label>
                            <div className="relative h-[500px] bg-white rounded-lg overflow-hidden border">
                                {/* Dummy Webpage Background */}
                                <div className="absolute inset-0 pointer-events-none opacity-50 flex flex-col">
                                    <div className="h-12 border-b flex items-center px-6 gap-4 bg-gray-50">
                                        <div className="h-4 w-24 bg-gray-300 rounded-md"></div>
                                        <div className="ml-auto flex gap-4">
                                            <div className="h-2 w-12 bg-gray-200 rounded"></div>
                                            <div className="h-2 w-12 bg-gray-200 rounded"></div>
                                            <div className="h-2 w-12 bg-gray-200 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="p-8 space-y-6 flex-1 overflow-hidden">
                                        <div className="space-y-3 max-w-lg">
                                            <div className="h-8 w-3/4 bg-gray-300 rounded-md"></div>
                                            <div className="h-4 w-full bg-gray-200 rounded-sm"></div>
                                            <div className="h-4 w-5/6 bg-gray-200 rounded-sm"></div>
                                            <div className="h-4 w-4/6 bg-gray-200 rounded-sm"></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 max-w-lg mt-8">
                                            <div className="h-32 bg-gray-100 rounded-lg"></div>
                                            <div className="h-32 bg-gray-100 rounded-lg"></div>
                                        </div>
                                    </div>
                                </div>
                                {/* Widget Container */}
                                <div className="absolute inset-0 flex items-end pointer-events-none" style={{ [settings.position.includes('right') ? 'justifyContent' : '']: settings.position.includes('right') ? 'flex-end' : 'flex-start', padding: '20px' }}>
                                <div id="sabnode-widget-container-preview" className="relative pointer-events-auto">
                                    {showWidget && (
                                        <div id="sabnode-widget-chatbox-preview" className="absolute" style={{ bottom: advancedSettings.styleVariant === 'modern' ? '80px' : '96px', right: advancedSettings.styleVariant === 'modern' ? '-10px' : '0', width: advancedSettings.styleVariant === 'modern' ? '320px' : '350px', backgroundColor: 'white', borderRadius: `${settings.borderRadius}px`, overflow: 'hidden', boxShadow: advancedSettings.styleVariant === 'modern' ? '0 10px 25px rgba(0,0,0,0.1)' : '0 5px 20px rgba(0,0,0,0.2)' }}>
                                            <div className="sabnode-chat-header" style={{ backgroundColor: settings.buttonColor, color: settings.buttonTextColor, padding: `${settings.padding}px`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Avatar className="w-10 h-10">
                                                    {settings.headerAvatarUrl && <ZoruAvatarImage src={settings.headerAvatarUrl} />}
                                                    <ZoruAvatarFallback>{settings.headerTitle.charAt(0)}</ZoruAvatarFallback>
                                                </Avatar>
                                                <div><div className="title font-bold">{settings.headerTitle}</div><div className="subtitle text-xs opacity-90">{settings.headerSubtitle}</div></div>
                                            </div>
                                            <div className="sabnode-chat-body" style={{ padding: `${settings.padding}px`, backgroundColor: advancedSettings.styleVariant === 'modern' ? '#f3f4f6' : '#E5DDD5' }}>
                                                <div className="sabnode-welcome-msg" style={{ background: 'white', color: settings.textColor, padding: '12px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{settings.welcomeMessage}</div>
                                            </div>
                                            <div className="sabnode-chat-footer" style={{ padding: `${settings.padding}px`, background: 'white', borderTop: '1px solid #eee' }}>
                                                <Button
                                                    className="sabnode-cta-button w-full h-12"
                                                    style={{ backgroundColor: settings.buttonColor, color: settings.buttonTextColor, borderRadius: advancedSettings.styleVariant === 'modern' ? '8px' : '9999px' }}
                                                    onClick={() => toast({ title: 'Widget Clicked', description: 'Action recorded' })}
                                                >
                                                    <WhatsAppIcon className="h-4 w-4 mr-2" />
                                                    {settings.ctaText}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    <Button
                                        id="sabnode-widget-button-preview"
                                        style={{ backgroundColor: settings.buttonColor, borderRadius: advancedSettings.styleVariant === 'modern' ? '16px' : '9999px' }}
                                        onClick={() => setShowWidget(!showWidget)}
                                        className={`relative ${advancedSettings.styleVariant === 'modern' ? 'h-14 w-14' : 'h-16 w-16'} shadow-lg`}
                                    >
                                        <WhatsAppIcon className={advancedSettings.styleVariant === 'modern' ? 'h-6 w-6' : 'h-8 w-8'} style={{ color: settings.buttonTextColor }} />
                                    </Button>
                                </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Embed Code</Label>
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
        </Card>
    );
}
