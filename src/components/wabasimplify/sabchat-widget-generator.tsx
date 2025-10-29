
'use client';

import { useState, useMemo, useActionState, useEffect } from 'react';
import type { WithId, User, SabChatSettings } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Code, Save, LoaderCircle, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CodeBlock } from './code-block';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { saveSabChatSettings } from '@/app/actions/sabchat.actions';
import { useFormStatus } from 'react-dom';

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

export function SabChatWidgetGenerator({ user }: { user: WithId<User> }) {
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
            toast({ title: 'Success!', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    const handleSettingChange = (field: keyof SabChatSettings, value: string | boolean) => {
        setSettings(prev => ({...prev, [field]: value}));
    }

    const embedCode = useMemo(() => {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        return `<script src="${appUrl}/api/sabchat/${user._id.toString()}" async defer></script>`;
    }, [user._id]);
    
    return (
        <Card>
            <form action={formAction}>
                 <input type="hidden" name="settings" value={JSON.stringify(settings)} />
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Code className="h-8 w-8" />
                        <div>
                            <CardTitle>Widget Configuration</CardTitle>
                            <CardDescription>Customize and install the live chat widget on your website.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid lg:grid-cols-2 gap-8 items-start">
                        {/* Customization Panel */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Widget Color</Label>
                                <Input type="color" value={settings.widgetColor} onChange={e => handleSettingChange('widgetColor', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Team Name</Label>
                                <Input value={settings.teamName} onChange={e => handleSettingChange('teamName', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Welcome Message</Label>
                                <Textarea value={settings.welcomeMessage} onChange={e => handleSettingChange('welcomeMessage', e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Avatar URL</Label>
                                <Input value={settings.avatarUrl} onChange={e => handleSettingChange('avatarUrl', e.target.value)} />
                            </div>
                        </div>
                        {/* Preview and Code Panel */}
                        <div className="space-y-4">
                            <Label>Live Preview</Label>
                            <div className="relative h-[400px] bg-muted rounded-lg overflow-hidden flex items-end p-4 justify-end">
                                <div className="static">
                                    <Button style={{ backgroundColor: settings.widgetColor }} onClick={() => setShowWidget(!showWidget)} className="relative h-16 w-16 rounded-full">
                                        <MessageSquare className="h-8 w-8" />
                                    </Button>
                                    {showWidget && (
                                         <div className="absolute bottom-[96px] right-[16px] w-[350px] bg-white rounded-lg shadow-2xl flex flex-col h-[300px]">
                                            <div style={{ backgroundColor: settings.widgetColor }} className="text-white p-4 flex items-center gap-3 rounded-t-lg">
                                                <Avatar>
                                                    {settings.avatarUrl && <AvatarImage src={settings.avatarUrl} />}
                                                    <AvatarFallback>{settings.teamName?.charAt(0) || 'S'}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h4 className="font-bold">{settings.teamName}</h4>
                                                </div>
                                            </div>
                                            <div className="flex-1 p-4 bg-slate-100">
                                                <div className="p-3 bg-white rounded-lg shadow-sm text-sm">
                                                    {settings.welcomeMessage}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2">
                                 <Label>Embed Code</Label>
                                 <p className="text-xs text-muted-foreground">Copy and paste this code before the closing `&lt;/body&gt;` tag on your website.</p>
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
