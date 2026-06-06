import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
    message: string;
    title?: string;
}

export default function ErrorState({ message, title = "Link Error" }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="bg-[var(--st-bg-muted)] text-[var(--st-text)] border border-[var(--st-border)] rounded-2xl p-8 max-w-md w-full shadow-sm flex flex-col items-center text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-[var(--st-text)]" />
                <h1 className="text-2xl font-bold">{title}</h1>
                <p className="text-[var(--st-text)]">{message}</p>
            </div>
        </div>
    );
}
