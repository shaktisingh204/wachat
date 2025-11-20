
import { signOut } from 'next-auth/react';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // This route is tricky with server components. 
  // The recommended way is to use a client component with a button that calls `signOut()`.
  // For a direct GET request, we can redirect.
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url);
}

// In your UI, you would have a component like this:
/*
'use client';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return <Button onClick={() => signOut({ callbackUrl: '/login' })}>Logout</Button>;
}
*/
