'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function SabChatRedirectPage() {
    useEffect(() => {
        redirect('/dashboard/sabchat/inbox');
    }, []);
    return null; 
}
