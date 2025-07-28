
'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";

export default function InstagramIndexPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/dashboard/instagram/connections');
    }, [router]);
    
    return (
        <div className="flex h-full w-full items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground"/>
        </div>
    )
}
