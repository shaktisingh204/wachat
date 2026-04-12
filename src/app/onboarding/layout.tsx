import Link from 'next/link';
import { SabNodeLogo } from '@/components/wabasimplify/logo';

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card/40 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <SabNodeLogo className="h-7 w-auto" />
                        <span className="text-lg font-semibold tracking-tight">
                            SabNode
                        </span>
                    </Link>
                    <Link
                        href="/login"
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        Already have an account? Sign in
                    </Link>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
                {children}
            </main>
            <footer className="border-t">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-muted-foreground sm:px-6">
                    <span>
                        © {new Date().getFullYear()} SabNode — all rights
                        reserved.
                    </span>
                    <Link
                        href="/privacy-policy"
                        className="hover:text-foreground"
                    >
                        Privacy Policy
                    </Link>
                </div>
            </footer>
        </div>
    );
}
