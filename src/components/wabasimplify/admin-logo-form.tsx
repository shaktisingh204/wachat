'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardFooter,
  Button,
  Input,
  Label,
  Separator,
} from '@/components/zoruui';
import {
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import { LoaderCircle, Save, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { setAppLogo } from '@/app/actions/admin.actions';
import { useRouter } from 'next/navigation';

import { SabFileUrlInput } from '@/components/sabfiles';

export function AppLogoForm() {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();
    const [logoUrl, setLogoUrl] = useState('');

    const formAction = (formData: FormData) => {
        startTransition(async () => {
            const result = await setAppLogo(null, formData);
            if (result.success) {
                toast({ title: 'Success!', description: 'App logo updated. It may take a moment to reflect everywhere.' });
                router.refresh();
            }
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <form action={formAction}>
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5"/>
                        Application Logo
                    </ZoruCardTitle>
                    <ZoruCardDescription>Set a custom logo for the application. You can either upload a file or provide a public URL. Leave both blank to reset to default.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="logoFile">Upload Logo File</ZoruLabel>
                        <ZoruInput id="logoFile" name="logoFile" type="file" accept="image/png, image/jpeg, image/svg+xml, image/webp" />
                    </div>
                     <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">Or</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="logoUrl">Logo URL</ZoruLabel>
                        <SabFileUrlInput
                            id="logoUrl"
                            name="logoUrl"
                            accept="image"
                            placeholder="https://example.com/logo.png"
                            value={logoUrl}
                            onChange={setLogoUrl}
                            disabled={isPending}
                        />
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <ZoruButton type="submit" disabled={isPending}>
                        {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Logo
                    </ZoruButton>
                </ZoruCardFooter>
            </ZoruCard>
        </form>
    );
}
