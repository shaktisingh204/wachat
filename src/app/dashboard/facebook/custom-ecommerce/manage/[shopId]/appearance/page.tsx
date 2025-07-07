
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Palette, Save, LoaderCircle, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState, useTransition, useActionState } from 'react';
import { getEcommShopById, updateEcommShopSettings } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, EcommShop } from '@/lib/definitions';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFormStatus } from 'react-dom';
import { useParams } from "next/navigation";

function PageSkeleton() {
    return (
        <div className="space-y-6">
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
    const params = useParams();
    const shopId = params.shopId as string;
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [state, formAction] = useActionState(updateEcommShopSettings, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (shopId) {
            startLoadingTransition(async () => {
                const shopData = await getEcommShopById(shopId);
                setShop(shopData);
            });
        }
    }, [shopId]);

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
                <AlertTitle>Shop Not Found</AlertTitle>
                <AlertDescription>Please select a valid shop to manage its appearance.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
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
