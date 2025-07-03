

'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { LoaderCircle, Save, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';

const initialState = { message: null, error: null };

function SaveButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save URL Shortener Settings
        </Button>
    )
}

export function UrlShortenerSettingsTab({ project }: { project: WithId<Project> }) {
    const { toast } = useToast();
    
    // Dummy action for now as these are placeholders
    const handleSubmit = async () => {
        toast({ title: "Note", description: "Advanced URL shortener settings are a work in progress." });
        return { message: "Settings saved (placeholder)." };
    };

    const [state, formAction] = useActionState(handleSubmit, initialState);

    return (
        <form action={formAction}>
            <Card className="card-gradient card-gradient-blue">
                <CardHeader>
                    <CardTitle>URL Shortener Settings</CardTitle>
                    <CardDescription>Configure advanced options for your short links.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="customDomain">Custom Domain</Label>
                        <div className="flex gap-2">
                            <Input id="customDomain" name="customDomain" placeholder="e.g., links.mybrand.com" disabled />
                            <Button type="button" disabled>Configure DNS</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Custom domain support is coming soon.</p>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h4 className="font-medium">Developer Options</h4>
                         <div className="space-y-2">
                            <Label htmlFor="apiKey">API Key</Label>
                            <div className="flex gap-2">
                                <Input id="apiKey" name="apiKey" value="********************************" disabled />
                                <Button type="button" variant="secondary" disabled>Regenerate</Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Programmatic URL creation via API is coming soon.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Browser Bookmarklet</Label>
                            <div className="p-3 bg-muted/80 rounded-md text-sm text-muted-foreground">
                                Drag this to your bookmarks bar to shorten the current page's URL instantly. (Feature coming soon)
                            </div>
                        </div>
                    </div>

                    <Separator />
                     <div className="space-y-4">
                        <h4 className="font-medium">Advanced Features</h4>
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <Label htmlFor="linkPreview" className="text-base">Enable Link Previews</Label>
                                <p className="text-sm text-muted-foreground">
                                    Show a preview page before redirecting.
                                </p>
                            </div>
                            <Switch id="linkPreview" name="linkPreview" disabled />
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                                <Label htmlFor="geoRedirect" className="text-base">Enable Geo-Location Redirects</Label>
                                <p className="text-sm text-muted-foreground">
                                    Redirect users based on their country.
                                </p>
                            </div>
                            <Switch id="geoRedirect" name="geoRedirect" disabled />
                        </div>
                     </div>


                </CardContent>
                <CardFooter>
                    <SaveButton />
                </CardFooter>
            </Card>
        </form>
    );
}
