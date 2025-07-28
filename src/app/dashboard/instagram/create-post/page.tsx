
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createInstagramImagePost } from '@/app/actions/instagram.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Send, X, Instagram } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const initialState = { message: null, error: null };

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" disabled={pending || disabled}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Post
        </Button>
    )
}

export default function CreateInstagramPostPage() {
    const [state, formAction] = useActionState(createInstagramImagePost, initialState);
    const { toast } = useToast();
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [projectId, setProjectId] = useState<string | null>(null);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            formRef.current?.reset();
            router.push('/dashboard/instagram/feed');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <div className="flex justify-center p-4">
            <form action={formAction} ref={formRef} className="w-full max-w-xl">
                <input type="hidden" name="projectId" value={projectId || ''} />
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                         <Button variant="ghost" size="icon" asChild>
                            <Link href="/dashboard/instagram/feed"><X className="h-5 w-5"/></Link>
                        </Button>
                        <h1 className="text-lg font-bold flex items-center gap-2"><Instagram className="h-5 w-5"/> Create Post</h1>
                        <SubmitButton disabled={!projectId} />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="imageUrl">Image URL</Label>
                            <Input id="imageUrl" name="imageUrl" type="url" placeholder="https://example.com/image.jpg" required />
                             <p className="text-xs text-muted-foreground">Your image must be publicly accessible.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="caption">Caption</Label>
                             <Textarea
                                name="caption"
                                placeholder="Write a caption..."
                                className="min-h-48"
                            />
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
