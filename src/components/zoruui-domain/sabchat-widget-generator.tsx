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
  Field,
  Input,
  Switch,
  Textarea,
  ColorPicker,
  Avatar,
  AvatarImage,
  AvatarFallback } from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import {
  useState,
  useMemo,
  useActionState,
  useEffect } from 'react';
import type { WithId,
  User,
  SabChatSettings } from '@/lib/definitions';
import { Code, Save, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CodeBlock } from './code-block';

import { saveSabChatSettings } from '@/app/actions/sabchat.actions';
import { useFormStatus } from 'react-dom';

const initialState: { message: string | null; error?: string } = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="primary" loading={pending} iconLeft={Save}>
            Save Widget Settings
        </Button>
    );
}

export function SabChatWidgetGenerator({ user }: { user: WithId<User> }) {
    // @ts-ignore
    const [state, formAction] = useActionState(saveSabChatSettings, initialState);
    const { toast } = useToast();
    const [showWidget, setShowWidget] = useState(false);

    const [settings, setSettings] = useState<SabChatSettings>(() => ({
        enabled: user.sabChatSettings?.enabled ?? true,
        widgetColor: user.sabChatSettings?.widgetColor || '#1f2937',
        welcomeMessage: user.sabChatSettings?.welcomeMessage || 'Hello! How can we help you today?',
        teamName: user.sabChatSettings?.teamName || user.name,
        avatarUrl: user.sabChatSettings?.avatarUrl || '',
        awayMessage: user.sabChatSettings?.awayMessage || 'We are currently away. Please leave a message!',
    }));

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Settings saved', description: state.message, tone: 'success' });
        }
        if (state.error) {
            toast({ title: 'Could not save settings', description: state.error || 'An error occurred.', tone: 'danger' });
        }
    }, [state, toast]);

    const handleSettingChange = (field: keyof SabChatSettings, value: string | boolean) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const embedCode = useMemo(() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        return `<script src="${appUrl}/api/sabchat/${user._id.toString()}" async defer></script>`;
    }, [user._id]);

    return (
        <Card>
            <form action={formAction}>
                <input type="hidden" name="_form" value="widget" />
                <input type="hidden" name="settings" value={JSON.stringify(settings)} />
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Code className="h-8 w-8 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        <div>
                            <CardTitle>Widget Configuration</CardTitle>
                            <CardDescription>Customize and install the live chat widget on your website.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className="grid lg:grid-cols-2 gap-8 items-start">
                        {/* Customization Panel */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 border border-[var(--st-border)] p-4 rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]">
                                <Switch
                                    id="widget-enabled"
                                    checked={settings.enabled}
                                    onCheckedChange={(checked) => handleSettingChange('enabled', checked)}
                                    aria-label="Enable chat widget"
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label htmlFor="widget-enabled">Enable Chat Widget</Label>
                                    <p className="text-sm text-[var(--st-text-secondary)]">
                                        {settings.enabled ? 'Widget is active and visible on your site.' : 'Widget is disabled and hidden from your site.'}
                                    </p>
                                </div>
                                {/* The action reads `formData.get('enabled') === 'on'`, so emit the
                                    hidden value only while the widget is enabled. */}
                                {settings.enabled && <input type="hidden" name="enabled" value="on" />}
                            </div>

                            <Field label="Widget Color" help="Used for the launcher button and chat header.">
                                <ColorPicker
                                    value={settings.widgetColor}
                                    onChange={(color) => handleSettingChange('widgetColor', color)}
                                />
                            </Field>
                            <Field label="Team Name">
                                <Input value={settings.teamName} onChange={e => handleSettingChange('teamName', e.target.value)} />
                            </Field>
                            <Field label="Welcome Message">
                                <Textarea value={settings.welcomeMessage} onChange={e => handleSettingChange('welcomeMessage', e.target.value)} />
                            </Field>
                            <Field label="Avatar Image" help="Shown next to your team name in the chat header.">
                                <SabFileUrlInput
                                    value={settings.avatarUrl}
                                    onChange={(url) => handleSettingChange('avatarUrl', url)}
                                    accept="image"
                                    placeholder="Pick an avatar from SabFiles"
                                    pickerTitle="Choose avatar image"
                                />
                            </Field>
                        </div>
                        {/* Preview and Code Panel */}
                        <div className="space-y-4">
                            <Label>Live Preview</Label>
                            <div className="relative h-[400px] bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] overflow-hidden flex items-end p-4 justify-end">
                                <div className="static">
                                    <Button
                                        type="button"
                                        aria-label={showWidget ? 'Hide chat preview' : 'Show chat preview'}
                                        style={{ backgroundColor: settings.widgetColor }}
                                        onClick={() => setShowWidget(!showWidget)}
                                        className="relative h-16 w-16 rounded-full text-white"
                                    >
                                        <MessageSquare className="h-8 w-8" aria-hidden="true" />
                                    </Button>
                                    {showWidget && (
                                        <div className="absolute bottom-[96px] right-[16px] w-[350px] bg-white rounded-[var(--st-radius)] shadow-2xl flex flex-col h-[300px]">
                                            <div style={{ backgroundColor: settings.widgetColor }} className="text-white p-4 flex items-center gap-3 rounded-t-[var(--st-radius)]">
                                                <Avatar>
                                                    {settings.avatarUrl && <AvatarImage src={settings.avatarUrl} alt={`${settings.teamName} avatar`} />}
                                                    <AvatarFallback>{settings.teamName?.charAt(0) || 'S'}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h4 className="font-bold">{settings.teamName}</h4>
                                                </div>
                                            </div>
                                            <div className="flex-1 p-4 bg-[var(--st-bg-muted)]">
                                                <div className="p-3 bg-white rounded-[var(--st-radius)] shadow-sm text-sm">
                                                    {settings.welcomeMessage}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Embed Code</Label>
                                <p className="text-xs text-[var(--st-text-secondary)]">Copy and paste this code before the closing `&lt;/body&gt;` tag on your website.</p>
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
