import { LoaderCircle } from 'lucide-react';
import { Card } from '@/components/zoruui';

export default function ExpiredLoading() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
            <Card className="max-w-md w-full p-8 flex flex-col items-center bg-zinc-900 border-zinc-800 shadow-2xl">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 mb-6 shadow-inner animate-pulse">
                    <LoaderCircle className="h-8 w-8 text-zinc-400 animate-spin" />
                </div>
                
                <div className="h-8 w-48 bg-zinc-800 rounded mb-4 animate-pulse"></div>
                <div className="h-4 w-64 bg-zinc-800 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-56 bg-zinc-800 rounded mb-8 animate-pulse"></div>

                <div className="w-full pt-4 border-t border-zinc-800/50">
                    <div className="h-10 w-full bg-zinc-800 rounded animate-pulse"></div>
                </div>
            </Card>
        </div>
    );
}
