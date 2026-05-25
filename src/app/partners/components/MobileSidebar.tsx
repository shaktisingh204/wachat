"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, ChevronRight, Building, Code2, Users, ArrowUpRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="lg:hidden p-2 text-white/70 hover:text-white">
          <Menu className="w-6 h-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-black text-white border-white/10 p-6 w-72">
        <SheetHeader className="mb-8 hidden">
          <SheetTitle className="text-left text-white">Navigation</SheetTitle>
          <SheetDescription className="text-left text-white/50">Partners page navigation</SheetDescription>
        </SheetHeader>
        <div className="space-y-10 text-sm overflow-y-auto">
          <div>
            <h3 className="font-bold text-white/40 uppercase tracking-widest mb-4 text-xs">Overview</h3>
            <ul className="space-y-4">
              <li><Link href="#introduction" onClick={() => setOpen(false)} className="text-white flex items-center justify-between group">Introduction <ChevronRight className="w-3 h-3"/></Link></li>
              <li><Link href="#benefits" onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">Benefits</Link></li>
              <li><Link href="#requirements" onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">Requirements</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold text-white/40 uppercase tracking-widest mb-4 text-xs">Programs</h3>
            <ul className="space-y-4">
              <li><Link href="#agency" onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors flex items-center gap-2"><Building className="w-3.5 h-3.5"/> Agency Partner</Link></li>
              <li><Link href="#developer" onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors flex items-center gap-2"><Code2 className="w-3.5 h-3.5"/> Tech Partner</Link></li>
              <li><Link href="#referral" onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors flex items-center gap-2"><Users className="w-3.5 h-3.5"/> Referral Partner</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-bold text-white/40 uppercase tracking-widest mb-4 text-xs">Resources</h3>
            <ul className="space-y-4">
              <li><Link href="#" onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors flex items-center gap-2">API Reference <ArrowUpRight className="w-3 h-3"/></Link></li>
              <li><Link href="#" onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors flex items-center gap-2">Brand Assets <ArrowUpRight className="w-3 h-3"/></Link></li>
              <li><Link href="#" onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors flex items-center gap-2">Support <ArrowUpRight className="w-3 h-3"/></Link></li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
