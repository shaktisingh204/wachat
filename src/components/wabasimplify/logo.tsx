
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getAppLogoUrl } from '@/app/actions/admin.actions';

let cachedLogoUrl: string | null = null;
let logoPromise: Promise<string | null> | null = null;

async function fetchAndCacheLogoUrl(): Promise<string | null> {
    if (cachedLogoUrl !== null) {
        return cachedLogoUrl;
    }
    
    // Use a promise to prevent multiple fetches during concurrent renders
    if (!logoPromise) {
        logoPromise = getAppLogoUrl().then(url => {
            cachedLogoUrl = url;
            logoPromise = null; 
            return url;
        }).catch(err => {
            console.error("Failed to fetch logo, using default.", err);
            logoPromise = null;
            return null;
        });
    }
    
    return logoPromise;
}

export const SabNodeLogo = ({ className }: { className?: string }) => {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchAndCacheLogoUrl().then(url => {
      setLogoUrl(url);
    });
  }, []);

  if (logoUrl) {
    return (
        <Image
          src={logoUrl}
          alt="SabNode Logo"
          width={128}
          height={32}
          className={className}
          priority
          style={{objectFit: 'contain'}}
        />
    );
  }

  // Fallback to SVG text if no URL is provided or during initial load
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
        fill="currentColor"
      >
        SabNode
      </text>
    </svg>
  );
};
