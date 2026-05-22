'use client';

import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  Button,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  Skeleton,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { handleUpdateUserProfile, getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle,
  Save } from 'lucide-react';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Preferences
        </Button>
    )
}

function UIPageSkeleton() {
    return (
        <Card>
            <ZoruCardHeader><Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-2/3 mt-2" /></ZoruCardHeader>
            <ZoruCardContent><Skeleton className="h-24 w-full" /></ZoruCardContent>
            <ZoruCardFooter><Skeleton className="h-10 w-32" /></ZoruCardFooter>
        </Card>
    );
}

export default function UiPreferencesPage() {
    const [user, setUser] = useState<(Omit<User, 'password'>) | null>(null);
    const [loading, setLoading] = useState(true);
    const [state, formAction] = useActionState(handleUpdateUserProfile, initialState);
    const { toast } = useToast();

    useEffect(() => {
        getSession().then(session => {
            if (session?.user) {
                setUser(session.user);
            }
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            // Potentially force a reload or use context to update layout instantly
            window.location.reload();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    if (loading) {
        return <UIPageSkeleton />;
    }

    if (!user) {
        return <UIPageSkeleton />;
    }

    return (
        <form action={formAction}>
            {/* Pass user's name so it doesn't get erased on save */}
            <input type="hidden" name="name" value={user.name} />
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>UI Preferences</ZoruCardTitle>
                    <ZoruCardDescription>Customize the look and feel of your dashboard.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>App Rail Position</Label>
                        <p className="text-sm text-muted-foreground">Choose where the main application navigation bar appears.</p>
                        <RadioGroup
                            name="appRailPosition"
                            defaultValue={user.appRailPosition || 'left'}
                            className="flex gap-4 pt-2"
                        >
                            <div className="flex items-center space-x-2">
                                <ZoruRadioGroupItem value="left" id="pos-left" />
                                <Label htmlFor="pos-left" className="font-normal">Left Sidebar</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <ZoruRadioGroupItem value="top" id="pos-top" />
                                <Label htmlFor="pos-top" className="font-normal">Top Header</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </Card>
        </form>
    );
}
