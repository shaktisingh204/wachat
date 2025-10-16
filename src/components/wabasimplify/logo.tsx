
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export const SabNodeLogo = ({ className }: { className?: string }) => {
  const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL;

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
