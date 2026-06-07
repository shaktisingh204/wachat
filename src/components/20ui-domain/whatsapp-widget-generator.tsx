'use client';

import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Input,
  Textarea,
  Field,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Separator,
  Switch,
  Slider,
  ColorPicker,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useMemo,
  useActionState,
  useEffect,
  useTransition } from 'react';
import type { WithId,
  Project } from '@/lib/definitions';
import { Code, Save, LoaderCircle, Palette, MessageSquare, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from './custom-sidebar-components';
import { CodeBlock } from './code-block';
import { saveWidgetSettings } from '@/app/actions/widget.actions';
import { saveAdvancedWidgetSettings } from '@/app/actions/wachat-widget-tracking.actions';
import type { AdvancedSettingsBody } from '@/lib/rust-client/wachat-widget-tracking';
import { useFormStatus } from 'react-dom';
import { SabFileUrlInput } from '@/components/sabfiles';

interface WhatsAppWidgetGeneratorProps {
    project: WithId<Project>;
}

const initialState: { message?: string; error?: string } = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="primary" disabled={pending} iconLeft={pending ? undefined : Save}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
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

    // --- Advanced Settings (now persisted server-side via the
    //     wachat-widget-tracking crate; localStorage kept only as a fast
    //     first-paint cache so the embed snippet renders before the action
    //     round-trips). ---
    const ADV_DEFAULTS: AdvancedSettingsBody = { autoOpenDelay: 0, abTestEnabled: false, styleVariant: 'classic' };

    const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettingsBody>(() => {
        // Server-backed value (widgetSettings.advanced) wins when present.
        const serverAdvanced = (project.widgetSettings as { advanced?: Partial<AdvancedSettingsBody> } | undefined)?.advanced;
        if (serverAdvanced) {
            return { ...ADV_DEFAULTS, ...serverAdvanced };
        }
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`widget_adv_${project._id}`);
            if (saved) {
                try {
                    return { ...ADV_DEFAULTS, ...(JSON.parse(saved) as Partial<AdvancedSettingsBody>) };
                } catch {
                    // ignore malformed cache
                }
            }
        }
        return ADV_DEFAULTS;
    });

    const [isSavingAdvanced, startSaveAdvanced] = useTransition();

    useEffect(() => {
        // Keep the local cache in sync for instant first-paint on reload.
        localStorage.setItem(`widget_adv_${project._id}`, JSON.stringify(advancedSettings));
    }, [advancedSettings, project._id]);

    const handleAdvancedSettingChange = (field: keyof AdvancedSettingsBody, value: string | number | boolean) => {
        setAdvancedSettings(prev => ({ ...prev, [field]: value }));
    }

    const handleSaveAdvanced = () => {
        startSaveAdvanced(async () => {
            const result = await saveAdvancedWidgetSettings(project._id.toString(), advancedSettings);
            if (result.success) {
                toast({ title: 'Saved', description: 'Advanced widget settings updated.' });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    // The embed snippet loads `/api/widget/{projectId}`, which serves the
    // injected tracker JS. That tracker `$inc`-s the same counters the Rust
    // `wachat-widget-tracking` crate now owns at
    // `POST /v1/wachat/widget/{projectId}/track`. The Rust route requires a
    // session JWT (AuthUser), so the public visitor-side ping can't call it
    // directly. FOLLOW-UP: repoint the generated tracker's `/api/widget/track`
    // POST at the Rust endpoint via the api-platform proxy or a thin public
    // Next route that forwards `{ eventType }` to the crate.
    const embedCode = useMemo(() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        let attrs = "";
        if (advancedSettings.autoOpenDelay > 0) attrs += ` data-auto-open="${advancedSettings.autoOpenDelay}"`;
        if (advancedSettings.abTestEnabled) attrs += ` data-ab-test="true"`;
        if (advancedSettings.styleVariant && advancedSettings.styleVariant !== 'classic') attrs += ` data-style="${advancedSettings.styleVariant}"`;
        return `<script src="${appUrl}/api/widget/${project._id.toString()}"${attrs} async defer></script>`;
    }, [project._id, advancedSettings]);

    return (
        <Card>
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
                        <Code className="h-8 w-8 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        <div>
                            <CardTitle>WhatsApp Widget Generator</CardTitle>
                            <CardDescription>Create a customizable chat widget to embed on your website.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className="grid lg:grid-cols-2 gap-8 items-start">
                        {/* Customization Panel */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" aria-hidden="true" />Content</CardTitle></CardHeader>
                                <CardBody className="space-y-4">
                                    <Field label="Phone Number">
                                        <Select value={settings.phoneNumber} onValueChange={(v) => handleSettingChange('phoneNumber', v)}>
                                            <SelectTrigger aria-label="Phone Number"><SelectValue placeholder="Select a number" /></SelectTrigger>
                                            <SelectContent>{project.phoneNumbers.map(phone => (<SelectItem key={phone.id} value={phone.display_phone_number}>{phone.display_phone_number}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </Field>
                                    <Field label="Welcome Message">
                                        <Textarea value={settings.welcomeMessage} onChange={e => handleSettingChange('welcomeMessage', e.target.value)} />
                                    </Field>
                                    <Field label="Pre-filled User Message">
                                        <Textarea value={settings.prefilledMessage} onChange={e => handleSettingChange('prefilledMessage', e.target.value)} />
                                    </Field>
                                </CardBody>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" aria-hidden="true" />Appearance</CardTitle></CardHeader>
                                <CardBody className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Position">
                                            <Select value={settings.position} onValueChange={(v) => handleSettingChange('position', v)}>
                                                <SelectTrigger aria-label="Position"><SelectValue placeholder="Pick a position" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                        <Field label="Widget Color">
                                            <ColorPicker value={settings.buttonColor} onChange={v => handleSettingChange('buttonColor', v)} />
                                        </Field>
                                    </div>
                                    <Field label="Header Title">
                                        <Input value={settings.headerTitle} onChange={e => handleSettingChange('headerTitle', e.target.value)} />
                                    </Field>
                                    <Field label="Header Subtitle">
                                        <Input value={settings.headerSubtitle} onChange={e => handleSettingChange('headerSubtitle', e.target.value)} />
                                    </Field>
                                    <Field label="Header Avatar" help="Pick an image from your SabFiles library or upload a new one.">
                                        <SabFileUrlInput
                                            accept="image"
                                            value={settings.headerAvatarUrl}
                                            onChange={(url) => handleSettingChange('headerAvatarUrl', url)}
                                            pickerTitle="Choose widget avatar"
                                        />
                                    </Field>
                                    <Field label="CTA Text">
                                        <Input value={settings.ctaText} onChange={e => handleSettingChange('ctaText', e.target.value)} />
                                    </Field>
                                    <Separator />
                                    <Field label={`Border Radius (${settings.borderRadius}px)`}>
                                        <Slider value={[settings.borderRadius]} onValueChange={v => handleSettingChange('borderRadius', (v as number[])[0])} min={0} max={50} ariaLabel="Border radius" />
                                    </Field>
                                    <Field label={`Padding (${settings.padding}px)`}>
                                        <Slider value={[settings.padding]} onValueChange={v => handleSettingChange('padding', (v as number[])[0])} min={8} max={32} ariaLabel="Padding" />
                                    </Field>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field label="Text Color">
                                            <ColorPicker value={settings.textColor} onChange={v => handleSettingChange('textColor', v)} />
                                        </Field>
                                        <Field label="Button Text Color">
                                            <ColorPicker value={settings.buttonTextColor} onChange={v => handleSettingChange('buttonTextColor', v)} />
                                        </Field>
                                    </div>
                                </CardBody>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" aria-hidden="true" />Behavior and Testing</CardTitle></CardHeader>
                                <CardBody className="space-y-4">
                                    <Field label="Auto-Open Delay (seconds)" help="Set to 0 to disable auto-open. For example, 5 means open after 5 seconds.">
                                        <Input type="number" min="0" value={advancedSettings.autoOpenDelay} onChange={e => handleAdvancedSettingChange('autoOpenDelay', parseInt(e.target.value) || 0)} placeholder="0 for disabled" />
                                    </Field>
                                    <Separator />
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <Label>A/B Test Variants</Label>
                                            <p className="text-xs text-[var(--st-text-secondary)]">Test classic vs alternative widget styles on your site.</p>
                                        </div>
                                        <Switch checked={advancedSettings.abTestEnabled} onCheckedChange={v => handleAdvancedSettingChange('abTestEnabled', v)} aria-label="Enable A/B test variants" />
                                    </div>
                                    {advancedSettings.abTestEnabled && (
                                        <Field label="Style Variant to Preview">
                                            <Select value={advancedSettings.styleVariant} onValueChange={(v) => handleAdvancedSettingChange('styleVariant', v)}>
                                                <SelectTrigger aria-label="Style variant"><SelectValue placeholder="Pick a variant" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="classic">Classic</SelectItem>
                                                    <SelectItem value="modern">Modern (Floating Box)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </Field>
                                    )}
                                    <Separator />
                                    <div className="flex justify-end">
                                        <Button type="button" variant="outline" disabled={isSavingAdvanced} onClick={handleSaveAdvanced} iconLeft={isSavingAdvanced ? undefined : Save}>
                                            {isSavingAdvanced ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                            Save Advanced Settings
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                        {/* Preview and Code Panel */}
                        <div className="space-y-4">
                            <Label>Live Preview</Label>
                            <div className="relative h-[500px] bg-[var(--st-bg)] rounded-[var(--st-radius)] overflow-hidden border border-[var(--st-border)]">
                                {/* Dummy Webpage Background */}
                                <div className="absolute inset-0 pointer-events-none opacity-50 flex flex-col">
                                    <div className="h-12 border-b border-[var(--st-border)] flex items-center px-6 gap-4 bg-[var(--st-bg-muted)]">
                                        <div className="h-4 w-24 bg-[var(--st-bg-muted)] rounded-md"></div>
                                        <div className="ml-auto flex gap-4">
                                            <div className="h-2 w-12 bg-[var(--st-bg-muted)] rounded"></div>
                                            <div className="h-2 w-12 bg-[var(--st-bg-muted)] rounded"></div>
                                            <div className="h-2 w-12 bg-[var(--st-bg-muted)] rounded"></div>
                                        </div>
                                    </div>
                                    <div className="p-8 space-y-6 flex-1 overflow-hidden">
                                        <div className="space-y-3 max-w-lg">
                                            <div className="h-8 w-3/4 bg-[var(--st-bg-muted)] rounded-md"></div>
                                            <div className="h-4 w-full bg-[var(--st-bg-muted)] rounded-sm"></div>
                                            <div className="h-4 w-5/6 bg-[var(--st-bg-muted)] rounded-sm"></div>
                                            <div className="h-4 w-4/6 bg-[var(--st-bg-muted)] rounded-sm"></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 max-w-lg mt-8">
                                            <div className="h-32 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)]"></div>
                                            <div className="h-32 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)]"></div>
                                        </div>
                                    </div>
                                </div>
                                {/* Widget Container */}
                                <div className={`absolute inset-0 flex items-end pointer-events-none p-5 ${settings.position.includes('right') ? 'justify-end' : 'justify-start'}`}>
                                <div id="sabnode-widget-container-preview" className="relative pointer-events-auto">
                                    {showWidget && (
                                        <div id="sabnode-widget-chatbox-preview" className="absolute bg-white overflow-hidden" style={{ bottom: advancedSettings.styleVariant === 'modern' ? '80px' : '96px', right: advancedSettings.styleVariant === 'modern' ? '-10px' : '0', width: advancedSettings.styleVariant === 'modern' ? '320px' : '350px', borderRadius: `${settings.borderRadius}px`, boxShadow: advancedSettings.styleVariant === 'modern' ? '0 10px 25px rgba(0,0,0,0.1)' : '0 5px 20px rgba(0,0,0,0.2)' }}>
                                            <div className="sabnode-chat-header flex items-center gap-3" style={{ backgroundColor: settings.buttonColor, color: settings.buttonTextColor, padding: `${settings.padding}px` }}>
                                                <Avatar className="w-10 h-10">
                                                    {settings.headerAvatarUrl && <AvatarImage src={settings.headerAvatarUrl} alt="" />}
                                                    <AvatarFallback>{settings.headerTitle.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div><div className="title font-bold">{settings.headerTitle}</div><div className="subtitle text-xs opacity-90">{settings.headerSubtitle}</div></div>
                                            </div>
                                            <div className="sabnode-chat-body" style={{ padding: `${settings.padding}px`, backgroundColor: advancedSettings.styleVariant === 'modern' ? '#f3f4f6' : '#E5DDD5' }}>
                                                <div className="sabnode-welcome-msg bg-white p-3 rounded-lg shadow-sm" style={{ color: settings.textColor }}>{settings.welcomeMessage}</div>
                                            </div>
                                            <div className="sabnode-chat-footer bg-white border-t border-[#eee]" style={{ padding: `${settings.padding}px` }}>
                                                <Button
                                                    variant="primary"
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
                                        variant="primary"
                                        aria-label={showWidget ? 'Close chat widget preview' : 'Open chat widget preview'}
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
                                <p className="text-xs text-[var(--st-text-secondary)]">Copy this single line of code and paste it before the closing `&lt;/body&gt;` tag on your website.</p>
                                <CodeBlock code={embedCode} />
                            </div>
                        </div>
                    </div>
                </CardBody>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </form>
        </Card>
    );
}
