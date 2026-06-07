"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, ChevronRight, Building, Code2, Users, ArrowUpRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  IconButton,
} from '@/components/sabcrm/20ui';

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton
          label="Open navigation"
          icon={Menu}
          variant="ghost"
          className="lg:hidden"
        />
      </SheetTrigger>
      <SheetContent side="left" closeLabel="Close navigation" className="p-6 w-72">
        <SheetHeader className="mb-8 hidden">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Partners page navigation</SheetDescription>
        </SheetHeader>
        <div className="space-y-10 text-sm overflow-y-auto">
          <div>
            <h3 className="font-bold uppercase tracking-widest mb-4 text-xs text-[var(--st-text-tertiary)]">Overview</h3>
            <ul className="space-y-4">
              <li>
                <Link
                  href="#introduction"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between group text-[var(--st-text)]"
                >
                  Introduction <ChevronRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link
                  href="#benefits"
                  onClick={() => setOpen(false)}
                  className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors"
                >
                  Benefits
                </Link>
              </li>
              <li>
                <Link
                  href="#requirements"
                  onClick={() => setOpen(false)}
                  className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors"
                >
                  Requirements
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-widest mb-4 text-xs text-[var(--st-text-tertiary)]">Programs</h3>
            <ul className="space-y-4">
              <li>
                <Link
                  href="#agency"
                  onClick={() => setOpen(false)}
                  className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"
                >
                  <Building className="w-3.5 h-3.5" aria-hidden="true" /> Agency Partner
                </Link>
              </li>
              <li>
                <Link
                  href="#developer"
                  onClick={() => setOpen(false)}
                  className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"
                >
                  <Code2 className="w-3.5 h-3.5" aria-hidden="true" /> Tech Partner
                </Link>
              </li>
              <li>
                <Link
                  href="#referral"
                  onClick={() => setOpen(false)}
                  className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"
                >
                  <Users className="w-3.5 h-3.5" aria-hidden="true" /> Referral Partner
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-widest mb-4 text-xs text-[var(--st-text-tertiary)]">Resources</h3>
            <ul className="space-y-4">
              <li>
                <Link
                  href="#"
                  onClick={() => setOpen(false)}
                  className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"
                >
                  API Reference <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  onClick={() => setOpen(false)}
                  className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"
                >
                  Brand Assets <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  onClick={() => setOpen(false)}
                  className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors flex items-center gap-2"
                >
                  Support <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
