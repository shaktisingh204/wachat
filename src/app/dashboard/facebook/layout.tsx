"use client";

/**
 * /dashboard/facebook layout — Meta Suite chrome.
 *
 * Inherits the parent /dashboard ZoruHomeShell (sidebar + dock + header).
 * This layout adds only the floating "Create Post" FAB. No bespoke
 * sidebar — Meta Suite navigation lives inside each page header.
 */

import * as React from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { ZoruButton } from "@/components/zoruui";

export default function FacebookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full">
      {children}
      <div className="fixed bottom-24 right-6 z-40">
        <ZoruButton asChild size="lg" className="h-14 w-14 rounded-full shadow-[var(--zoru-shadow-lg)]">
          <Link href="/dashboard/facebook/create-post" aria-label="Create Post">
            <Pencil className="h-5 w-5" />
          </Link>
        </ZoruButton>
      </div>
    </div>
  );
}
