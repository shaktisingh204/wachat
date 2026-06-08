import '@/components/sabcrm/20ui/tokens.css';
import Link from 'next/link';
import { SabNodeLogo } from '@/components/20ui-domain/logo';

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="20ui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <header className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]/60 backdrop-blur-sm">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-2">
                        <SabNodeLogo className="h-7 w-auto" />
                        <span className="text-lg font-semibold tracking-tight">
                            SabNode
                        </span>
                    </Link>
                    <Link
                        href="/login"
                        className="text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    >
                        Already have an account? Sign in
                    </Link>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
                {children}
            </main>
            <footer className="border-t border-[var(--st-border)]">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-[var(--st-text-secondary)] sm:px-6">
                    <span suppressHydrationWarning>
                        © {new Date().getFullYear()} SabNode - all rights
                        reserved.
                    </span>
                    <Link
                        href="/privacy-policy"
                        className="hover:text-[var(--st-text)]"
                    >
                        Privacy Policy
                    </Link>
                </div>
            </footer>
        </div>
    );
}
