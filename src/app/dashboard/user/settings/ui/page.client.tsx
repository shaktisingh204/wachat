'use client';

import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState
} from 'react';
import { useRouter } from 'next/navigation';
import { handleUpdateUserProfile, getSession } from '@/app/actions/user.actions';
import type { User } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';

import { SubmitButton } from './components/SubmitButton';
import { UIPageSkeleton } from './components/UIPageSkeleton';
import { AppRailSettings } from './components/AppRailSettings';
import { LanguageSettings } from './components/LanguageSettings';

interface UpdateProfileActionState {
    message?: string;
    error?: string;
}

const initialState: UpdateProfileActionState = { message: undefined, error: undefined };

export default function UiPreferencesPage() {
    const [user, setUser] = useState<(Omit<User, 'password'>) | null>(null);
    const [loading, setLoading] = useState(true);
    const [state, formAction] = useActionState<UpdateProfileActionState, FormData>(handleUpdateUserProfile, initialState);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;
        getSession().then(session => {
            if (isMounted) {
                if (session?.user) {
                    setUser(session.user);
                }
                setLoading(false);
            }
        }).catch(err => {
            console.error("Failed to fetch session:", err);
            if (isMounted) {
                setLoading(false);
            }
        });
        
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            // Enhance real-time updates: refresh the router instead of hard reload
            router.refresh();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    // Error catching and loading state handling
    if (loading) {
        return <UIPageSkeleton />;
    }

    if (!user) {
        return (
            <div className="text-center py-10 text-[var(--st-text-secondary)]">
                <p>Unable to load user preferences. Please try refreshing the page.</p>
            </div>
        );
    }

    return (
        <form action={formAction}>
            {/* Pass user's name so it doesn't get erased on save */}
            <input type="hidden" name="name" value={user.name || ''} />
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>UI Preferences</ZoruCardTitle>
                    <ZoruCardDescription>Customize the look and feel of your dashboard.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-6">
                    <AppRailSettings currentPosition={user.appRailPosition} />
                    <LanguageSettings currentLanguage={user.language} />
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </Card>
        </form>
    );
}
