

'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

// A simple cache to avoid re-fetching on every render within the same session.
let cachedLogoUrl: string | null = null;

async function getLogoUrl(): Promise<string | null> {
    if (cachedLogoUrl !== null) {
        return cachedLogoUrl;
    }
    
    // This is a client-side fetch, but it could be a server action in a real app
    // to get a value from a database or a configuration service.
    // For this example, we will simulate it. In a real app this would be:
    // const { db } = await connectToDatabase();
    // const logoSetting = await db.collection('system_settings').findOne({ _id: 'app_logo' });
    // cachedLogoUrl = logoSetting?.url || process.env.NEXT_PUBLIC_LOGO_URL || '';

    // Since we can't do DB calls on the client, we simulate this.
    // If you have an API route for this, you could fetch it.
    cachedLogoUrl = process.env.NEXT_PUBLIC_LOGO_URL || '';
    return cachedLogoUrl;
}


export const SabNodeLogo = ({ className }: { className?: string }) => {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    // We cannot call server actions directly in a client component's render logic,
    // so we use a `useEffect` hook to fetch the data on the client side.
    // A more robust solution might involve a client-side data fetching library
    // or passing the initial URL as a prop from a server component.
    const fetchLogo = async () => {
        const url = await getLogoUrl();
        setLogoUrl(url);
    };
    fetchLogo();
  }, []);

  if (logoUrl) {
    return (
      <Link href="/" className="flex items-center">
        <Image
          src={logoUrl}
          alt="SabNode Logo"
          width={128}
          height={32}
          className={className}
          priority
          style={{objectFit: 'contain'}}
        />
      </Link>
    );
  }

  // Fallback to SVG text if no URL is provided
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" className={className}>
      <text
        x="50%"
        y="50%"
        dy=".35em"
        textAnchor="middle"
        fontFamily="'PT Sans', sans-serif"
        fontSize="30"
        fontWeight="bold"
        fill="hsl(var(--primary))"
      >
        SabNode
      </text>
    </svg>
  );
};
