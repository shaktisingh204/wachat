"use client";

import { useEffect } from "react";
import { Button } from "@/components/zoruui";

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
            <div className="text-center">
                <h2 className="text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
                <p className="text-sm text-zoru-ink-muted">Failed to load salary structure details.</p>
            </div>
            <Button onClick={() => reset()}>Try again</Button>
        </div>
    );
}
