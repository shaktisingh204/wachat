import { Card, EmptyState, Button } from '@/components/sabcrm/20ui';
import { FileQuestion, Home } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="20ui flex min-h-screen items-center justify-center bg-[var(--st-bg)] p-4">
            <Card variant="elevated" padding="lg" className="w-full max-w-md">
                <EmptyState
                    icon={FileQuestion}
                    title="Share not found"
                    description="This shared link doesn't exist or has been removed by the owner."
                    action={
                        <Button variant="primary" iconLeft={Home}>
                            <Link href="/">Go home</Link>
                        </Button>
                    }
                />
            </Card>
        </main>
    );
}
