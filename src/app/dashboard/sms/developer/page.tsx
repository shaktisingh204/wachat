'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ApiKeyManager } from "./api-keys-manager";

export default function SmsDeveloperPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Developer API</h1>
            <p className="text-muted-foreground">Integrate SMS capabilities directly into your applications.</p>

            <Tabs defaultValue="otp" className="w-full">
                <TabsList>
                    <TabsTrigger value="otp">Send OTP / Transactional</TabsTrigger>
                    <TabsTrigger value="keys">API Keys</TabsTrigger>
                    <TabsTrigger value="webhook">Webhooks</TabsTrigger>
                </TabsList>
                <TabsContent value="otp" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Send Transactional SMS</CardTitle>
                            <CardDescription>Endpoint for sending high-priority OTPs or alerts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-muted p-4 rounded-md font-mono text-sm relative">
                                <span className="text-blue-500">POST</span> /api/v1/sms/send
                                <div className="mt-2 text-muted-foreground">
                                    {`{
  "to": "919876543210",
  "templateId": "your_dlt_template_id",
  "variables": ["123456"] // Maps to {#var#}
}`}
                                </div>
                            </div>
                            <p className="text-sm">Note: Authentication headers required (Bearer Token).</p>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="keys">
                    <ApiKeyManager />
                </TabsContent>
                <TabsContent value="webhook">
                    <Card>
                        <CardHeader>
                            <CardTitle>Delivery Reports</CardTitle>
                            <CardDescription>Receive real-time updates on message status.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm mb-2">Configure your provider to send webhooks to:</p>
                            <div className="bg-muted p-2 rounded-md font-mono text-sm inline-block">
                                https://sabnode.com/api/sms/webhook
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
