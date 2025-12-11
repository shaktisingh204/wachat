
'use client';

// This file is now a placeholder and is not used.
// The new authentication system does not require a client-side SessionProvider.
// The session is managed via server components and server-side cookies.
// The main layout now uses a ProjectProvider for state management instead.

import React from 'react';

export default function AppSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>;
}
