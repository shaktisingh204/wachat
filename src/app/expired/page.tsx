import Link from 'next/link';
import { Clock } from 'lucide-react';

export default function ExpiredLinkPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 mb-6">
                <Clock className="h-8 w-8 text-zinc-400" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">This link has expired</h1>
            <p className="text-sm text-zinc-400 max-w-xs mb-8">
                The link you followed is no longer active. It may have reached its expiry date or click limit.
            </p>
            <Link
                href="/"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
                Powered by SabNode
            </Link>
        </div>
    );
}
