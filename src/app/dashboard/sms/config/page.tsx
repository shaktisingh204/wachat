
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSmsConfig, saveSmsConfig } from "@/app/actions/sms-config.actions";
import { User } from "lucide-react"; // Just for an icon

export default async function SmsConfigPage() {
    const config = await getSmsConfig();
    const defaultTab = config?.provider || 'twilio';

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h3 className="text-lg font-medium">SMS Provider Configuration</h3>
                <p className="text-sm text-muted-foreground">
                    Configure your preferred SMS gateway. For India, MSG91 with DLT registration is recommended.
                </p>
            </div>

            <form action={saveSmsConfig}>
                <Card>
                    <CardHeader>
                        <CardTitle>Provider Settings</CardTitle>
                        <CardDescription>Enter your API credentials below.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue={defaultTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="twilio">Twilio</TabsTrigger>
                                <TabsTrigger value="msg91">MSG91 (India DLT)</TabsTrigger>
                            </TabsList>

                            {/* Hidden Input to store the active provider value when submitting. 
                    NOTE: Using Tabs to switch visuals, but we need to ensure the correct 'provider' value is sent. 
                    A simpler way is to use client state, but standard form submission works if we just use a Select or hidden field.
                    Here we force the user to pick via a Select or we can infer from the tab if we use client logic.
                    
                    Simpler approach for Server Actions: Use Client Component wrapper or just standard Inputs.
                    Let's add a hidden input that users might need to toggle, OR just keep it simple: 
                    "Select Provider" dropdown first? 
                    
                    Let's keep tabs but add a hidden input relying on default values or JS. 
                    Actually, let's use a Select for Provider to be unambiguous. */}

                            <div className="mt-4 mb-4">
                                <Label>Active Provider</Label>
                                <select name="provider" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" defaultValue={defaultTab}>
                                    <option value="twilio">Twilio</option>
                                    <option value="msg91">MSG91</option>
                                </select>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    {/* Common DLT Fields */}
                                    <div className="space-y-2">
                                        <Label htmlFor="principalEntityId">DLT Principal Entity ID (India Only)</Label>
                                        <Input name="principalEntityId" id="principalEntityId" placeholder="1001..." defaultValue={config?.dlt?.principalEntityId} />
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-4">
                                    <h4 className="text-sm font-semibold mb-2">Twilio Credentials</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="accountSid">Account SID</Label>
                                            <Input name="accountSid" id="accountSid" placeholder="AC..." defaultValue={config?.credentials?.accountSid} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="authToken">Auth Token</Label>
                                            <Input type="password" name="authToken" id="authToken" placeholder="Token" defaultValue={config?.credentials?.authToken} />
                                        </div>
                                        <div className="space-y-2 col-span-2">
                                            <Label htmlFor="fromNumber">From Number</Label>
                                            <Input name="fromNumber" id="fromNumber" placeholder="+1234567890" defaultValue={config?.credentials?.fromNumber} />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-4">
                                    <h4 className="text-sm font-semibold mb-2">MSG91 Credentials</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="authKey">Auth Key</Label>
                                            <Input name="authKey" id="authKey" placeholder="Generated Auth Key" defaultValue={config?.credentials?.authKey} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="senderId">Sender ID (6 Chars)</Label>
                                            <Input name="senderId" id="senderId" maxLength={6} placeholder="WACHAT" defaultValue={config?.credentials?.senderId} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Tabs>
                    </CardContent>
                    <div className="p-6 pt-0 flex justify-end">
                        <Button type="submit">Save Configuration</Button>
                    </div>
                </Card>
            </form>
        </div>
    );
}
