'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveSmsConfig } from "@/app/actions/sms-config.actions";
import { useState } from "react";


// We pass this as props to avoid importing server-only code if any
type ProviderOption = { id: string; name: string; type: string };

export default function SmsConfigForm({
    initialConfig,
    providers
}: {
    initialConfig: any,
    providers: ProviderOption[]
}) {
    const [selectedProvider, setSelectedProvider] = useState<string>(initialConfig?.provider || 'twilio');

    async function handleSubmit(formData: FormData) {
        try {
            const result = await saveSmsConfig(formData);
            if (result.success) {
                // toast.success(result.message);
                alert(result.message);
            }
        } catch (e: any) {
            alert(e.message);
        }
    }

    return (
        <form action={handleSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>Provider Settings</CardTitle>
                    <CardDescription>Select your gateway and enter API credentials.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    <div className="space-y-2">
                        <Label>Select Provider</Label>
                        <Select name="provider" value={selectedProvider} onValueChange={setSelectedProvider}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a provider" />
                            </SelectTrigger>
                            <SelectContent>
                                {providers.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* DLT Section - Always visible for Indian Context or make generic? */}
                    <div className="space-y-2 border-b pb-4">
                        <Label htmlFor="principalEntityId">DLT Principal Entity ID (India)</Label>
                        <Input
                            name="principalEntityId"
                            id="principalEntityId"
                            placeholder="1001..."
                            defaultValue={initialConfig?.dlt?.principalEntityId}
                        />
                        <p className="text-xs text-muted-foreground">Required for all Indian routes (Twilio, MSG91, others).</p>
                    </div>


                    {/* Dynamic Fields */}
                    {selectedProvider === 'twilio' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label>Account SID</Label>
                                <Input name="accountSid" required defaultValue={initialConfig?.credentials?.accountSid} />
                            </div>
                            <div className="space-y-2">
                                <Label>Auth Token</Label>
                                <Input type="password" name="authToken" required defaultValue={initialConfig?.credentials?.authToken} />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>From Number</Label>
                                <Input name="fromNumber" required defaultValue={initialConfig?.credentials?.fromNumber} />
                            </div>
                        </div>
                    )}

                    {selectedProvider === 'msg91' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label>Auth Key</Label>
                                <Input name="authKey" required defaultValue={initialConfig?.credentials?.authKey} />
                            </div>
                            <div className="space-y-2">
                                <Label>Sender ID (6 Chars)</Label>
                                <Input name="senderId" required maxLength={6} defaultValue={initialConfig?.credentials?.senderId} />
                            </div>
                        </div>
                    )}

                    {(selectedProvider === 'gupshup') && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label>User ID / Account</Label>
                                <Input name="userId" required defaultValue={initialConfig?.credentials?.userId} />
                            </div>
                            <div className="space-y-2">
                                <Label>Password / API Key</Label>
                                <Input type="password" name="password" required defaultValue={initialConfig?.credentials?.password} />
                            </div>
                        </div>
                    )}

                    {(selectedProvider === 'plivo') && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label>Auth ID</Label>
                                <Input name="authId" required defaultValue={initialConfig?.credentials?.authId} />
                            </div>
                            <div className="space-y-2">
                                <Label>Auth Token</Label>
                                <Input type="password" name="authToken" required defaultValue={initialConfig?.credentials?.authToken} />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Source Number / Sender ID</Label>
                                <Input name="src" required defaultValue={initialConfig?.credentials?.src} />
                            </div>
                        </div>
                    )}

                    {/* Generic / Other Adapters */}
                    {['fast2sms', 'textlocal', 'clickatell', 'karix', 'valuefirst', 'kaleyra', 'twofactor', 'sinch', 'infobip', 'messagebird', 'telesign', 'bandwidth', 'cm_com', 'routemobile', 'generic'].includes(selectedProvider) && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="bg-muted p-4 rounded-md text-sm">
                                <p><strong>Generic Configuration:</strong> Most of these providers use a standard API Key or Base URL.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>API Key / Auth Token</Label>
                                <Input name="apiKey" required defaultValue={initialConfig?.credentials?.apiKey} placeholder="Enter your API Key provided by the gateway" />
                            </div>
                            <div className="space-y-2">
                                <Label>Base URL (Optional override)</Label>
                                <Input name="baseUrl" defaultValue={initialConfig?.credentials?.baseUrl} placeholder="Leave empty to use default preset URL" />
                            </div>
                            <div className="space-y-2">
                                <Label>Sender ID / Source</Label>
                                <Input name="senderId" defaultValue={initialConfig?.credentials?.senderId} placeholder="e.g. TXTLCL" />
                            </div>
                        </div>
                    )}

                </CardContent>
                <div className="p-6 pt-0 flex justify-end">
                    <Button type="submit">Save Configuration</Button>
                </div>
            </Card>
        </form>
    );
}
