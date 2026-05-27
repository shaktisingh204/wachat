import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
    message: string;
    title?: string;
}

export default function ErrorState({ message, title = "Link Error" }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="bg-zoru-surface-2 text-zoru-ink border border-zoru-line rounded-2xl p-8 max-w-md w-full shadow-sm flex flex-col items-center text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-zoru-ink" />
                <h1 className="text-2xl font-bold">{title}</h1>
                <p className="text-zoru-ink">{message}</p>
            </div>
        </div>
    );
}
