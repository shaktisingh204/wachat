
'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BookOpen, Key, Link2, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UrlShortenerSettingsPage() {
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        toast({ title: "Coming Soon!", description: "Custom domain support is under development." });
    };

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">URL Shortener Settings</h1>
                <p className="text-muted-foreground">Configure custom domains and developer settings for your short links.</p>
            </div>
            
            <form onSubmit={handleSubmit} ref={formRef}>
                <Card className="card-gradient card-gradient-blue">
                    <CardHeader>
                        <CardTitle>Custom Domains</CardTitle>
                        <CardDescription>Use your own domain for branded short links (e.g., links.mybrand.com).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert>
                            <Link2 className="h-4 w-4" />
                            <AlertTitle>Feature Coming Soon!</AlertTitle>
                            <AlertDescription>
                                The ability to add and verify custom domains is currently under development.
                            </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                            <Label htmlFor="customDomain">Your Domain</Label>
                            <div className="flex gap-2">
                                <Input id="customDomain" name="customDomain" placeholder="e.g., links.mybrand.com" disabled />
                                <Button type="submit" disabled>Add Domain</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </form>
            
            <Card className="card-gradient card-gradient-purple">
                <CardHeader>
                    <CardTitle>Developer Options</CardTitle>
                    <CardDescription>For programmatic access and integrations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <div className="flex gap-2">
                            <Input id="apiKey" name="apiKey" value="********************************" disabled />
                            <Button type="button" variant="secondary" disabled>Regenerate</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Programmatic URL creation via API is coming soon.</p>
                    </div>
                </CardContent>
                 <CardFooter>
                     <Button type="button" variant="outline" disabled>
                        <BookOpen className="mr-2 h-4 w-4" /> View API Docs
                    </Button>
                </CardFooter>
            </Card>

        </div>
    );
}
