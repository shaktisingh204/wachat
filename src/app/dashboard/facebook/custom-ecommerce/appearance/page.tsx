

'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Palette, Save, LoaderCircle, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState, useTransition, useActionState } from 'react';
import { getProjectById } from '@/app/actions';
import { getEcommShopById, updateEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, Project, EcommShop } from '@/lib/definitions';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFormStatus } from 'react-dom';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-64"/>
            <Skeleton className="h-4 w-96"/>
            <div className="space-y-4">
                <Skeleton className="h-80 w-full" />
            </div>
        </div>
    );
}

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Appearance
        </Button>
    )
}

export default function AppearancePage() {
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [state, formAction] = useActionState(updateEcommShopSettings, initialState);
    const { toast } = useToast();

    useEffect(() => {
        startLoadingTransition(async () => {
            const storedProjectId = localStorage.getItem('activeProjectId');
            if (storedProjectId) {
                // In a multi-shop world, we'd need a way to select a shop.
                // For now, let's assume one shop per project for simplicity on this page.
                const project = await getProjectById(storedProjectId);
                if (project && project.ecommSettings) {
                    // This page is now a bit broken due to multi-shop. Let's fix it later.
                }
            }
        });
    }, []);

    useEffect(() => {
        if (state.message) toast({ title: 'Success', description: state.message });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!shop) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Shop Selected</AlertTitle>
                <AlertDescription>Please select a shop to manage its appearance.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Palette /> Appearance</h1>
                <p className="text-muted-foreground">Customize the look and feel of your custom shop.</p>
            </div>
            <form action={formAction}>
                 <input type="hidden" name="shopId" value={shop._id.toString()} />
                <Card>
                    <CardHeader>
                        <CardTitle>Shop Design</CardTitle>
                        <CardDescription>Changes made here will affect the look of your custom e-commerce webview.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <Label htmlFor="appearance_primaryColor">Primary Color</Label>
                                <Input id="appearance_primaryColor" name="appearance_primaryColor" type="color" defaultValue={shop?.appearance?.primaryColor || '#000000'} className="h-12"/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="appearance_fontFamily">Font Family</Label>
                                <Select name="appearance_fontFamily" defaultValue={shop?.appearance?.fontFamily || 'Inter'}>
                                    <SelectTrigger id="appearance_fontFamily"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Inter">Inter (sans-serif)</SelectItem>
                                        <SelectItem value="Roboto">Roboto (sans-serif)</SelectItem>
                                        <SelectItem value="Lato">Lato (sans-serif)</SelectItem>
                                        <SelectItem value="Merriweather">Merriweather (serif)</SelectItem>
                                        <SelectItem value="Playfair Display">Playfair Display (serif)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="appearance_bannerImageUrl">Banner Image URL</Label>
                             <div className="relative">
                                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input id="appearance_bannerImageUrl" name="appearance_bannerImageUrl" type="url" defaultValue={shop?.appearance?.bannerImageUrl || ''} placeholder="https://example.com/banner.png" className="pl-10" />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
