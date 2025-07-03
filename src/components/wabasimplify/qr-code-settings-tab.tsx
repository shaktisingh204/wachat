
'use client';

import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BookOpen } from 'lucide-react';
import { Separator } from '../ui/separator';

export function QrCodeSettingsTab() {
    return (
        <Card className="card-gradient card-gradient-purple">
            <CardHeader>
                <CardTitle>QR Code Maker Settings</CardTitle>
                <CardDescription>Configure advanced options for your generated QR Codes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <h4 className="font-medium">Developer Options</h4>
                     <div className="space-y-2">
                        <Label htmlFor="qrApiKey">API Key</Label>
                        <div className="flex gap-2">
                            <Input id="qrApiKey" name="qrApiKey" value="********************************" disabled />
                            <Button type="button" variant="secondary" disabled>Regenerate</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Programmatic QR Code generation via API is coming soon.</p>
                    </div>
                </div>

                <Separator />
                 <div className="space-y-4">
                    <h4 className="font-medium">Advanced Features</h4>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <Label htmlFor="dynamicQr" className="text-base">Enable Dynamic QR Codes & Analytics</Label>
                            <p className="text-sm text-muted-foreground">
                                Track scans and edit the destination URL after creation.
                            </p>
                        </div>
                        <Switch id="dynamicQr" name="dynamicQr" disabled />
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <Label htmlFor="logoEmbedding" className="text-base">Embed Logo in QR Code</Label>
                            <p className="text-sm text-muted-foreground">
                                Add your brand's logo to the center of the QR code.
                            </p>
                        </div>
                        <Switch id="logoEmbedding" name="logoEmbedding" disabled />
                    </div>
                 </div>
            </CardContent>
            <CardFooter>
                 <Button type="button" variant="outline" disabled>
                    <BookOpen className="mr-2 h-4 w-4" /> View API Docs
                </Button>
            </CardFooter>
        </Card>
    );
}
