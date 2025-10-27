
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { setAppLogo } from '@/app/actions/admin.actions';
import { useRouter } from 'next/navigation';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Logo
    </Button>
  );
}

export function AppLogoForm() {
    const [state, formAction] = useActionState(setAppLogo, initialState);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (state.success) {
            toast({ title: 'Success!', description: 'App logo updated. It may take a moment to reflect everywhere.' });
            router.refresh();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <form action={formAction}>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5"/>
                        Application Logo
                    </CardTitle>
                    <CardDescription>Set a custom logo for the application. Leave blank to reset to the default.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="logoUrl">Logo URL</Label>
                        <Input id="logoUrl" name="logoUrl" placeholder="https://example.com/logo.png" />
                        <p className="text-xs text-muted-foreground">Provide a public URL to your logo image.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
