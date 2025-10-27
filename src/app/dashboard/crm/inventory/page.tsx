
'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InventoryRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/crm/inventory/items');
    }, [router]);

    return null;
}
