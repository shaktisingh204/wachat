'use client';

import React, { useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/zoruui/card';
import { Input } from '@/components/zoruui/input';
import { Label } from '@/components/zoruui/label';
import { Button } from '@/components/zoruui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/zoruui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/zoruui/table';
import { UploadCloud } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsap from 'context/gsap'; // We'll just import gsap from 'gsap' usually, assuming standard import
// Wait, the skill says: import { useGSAP } from "@gsap/react"; and use gsap. Let's do `import gsap from "gsap";`
import gsapCore from 'gsap';

export default function VouchersPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Register plugin is better done at layout level, but we can do it here if needed or just useGSAP directly.
  gsapCore.registerPlugin(useGSAP);

  useGSAP(() => {
    gsapCore.from('.animate-fade', {
      y: 20,
      opacity: 0,
      stagger: 0.1,
      duration: 0.5,
      ease: 'power2.out'
    });
  }, { scope: containerRef });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcuts for saving
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        console.log('Saved voucher');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="p-6 space-y-6" ref={containerRef}>
      <div className="animate-fade flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voucher Entry</h1>
          <p className="text-muted-foreground mt-1">
            Fast, keyboard-first data entry. Use Tab and Shift+Tab to navigate. Cmd+S to save.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground font-medium">Active Editors:</div>
          <div className="flex -space-x-3">
            <Avatar className="w-8 h-8 border-2 border-background">
              <AvatarImage src="https://i.pravatar.cc/100?img=1" />
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <Avatar className="w-8 h-8 border-2 border-background">
              <AvatarImage src="https://i.pravatar.cc/100?img=2" />
              <AvatarFallback>B</AvatarFallback>
            </Avatar>
            <Avatar className="w-8 h-8 border-2 border-background flex items-center justify-center bg-muted text-xs">
              +2
            </Avatar>
          </div>
        </div>
      </div>

      <div className="animate-fade max-w-4xl border-2 border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer">
        <UploadCloud className="w-10 h-10 text-primary mb-2" />
        <h3 className="font-semibold">AI Zero-Data Entry (OCR)</h3>
        <p className="text-sm text-muted-foreground">Drag and drop a receipt or invoice here, and AI will auto-fill the voucher below.</p>
      </div>

      <Card className="animate-fade max-w-4xl">
        <CardHeader>
          <CardTitle>New Voucher</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Voucher Type</Label>
              <Select defaultValue="journal">
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipt">Receipt (F6)</SelectItem>
                  <SelectItem value="payment">Payment (F5)</SelectItem>
                  <SelectItem value="journal">Journal (F7)</SelectItem>
                  <SelectItem value="contra">Contra (F4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="space-y-2">
              <Label>Voucher No.</Label>
              <Input type="text" placeholder="Auto-generated" disabled />
            </div>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Dr/Cr</TableHead>
                  <TableHead>Particulars (Ledger Account)</TableHead>
                  <TableHead className="text-right">Debit (₹)</TableHead>
                  <TableHead className="text-right">Credit (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Select defaultValue="dr">
                      <SelectTrigger className="border-0 focus:ring-0 px-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dr">Dr</SelectItem>
                        <SelectItem value="cr">Cr</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input placeholder="Search Ledger (Alt+L)..." className="border-0 focus-visible:ring-1" autoFocus />
                  </TableCell>
                  <TableCell>
                    <Input type="number" placeholder="0.00" className="border-0 focus-visible:ring-1 text-right" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" placeholder="0.00" className="border-0 focus-visible:ring-1 text-right" disabled />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Select defaultValue="cr">
                      <SelectTrigger className="border-0 focus:ring-0 px-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dr">Dr</SelectItem>
                        <SelectItem value="cr">Cr</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input placeholder="Search Ledger (Alt+L)..." className="border-0 focus-visible:ring-1" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" placeholder="0.00" className="border-0 focus-visible:ring-1 text-right" disabled />
                  </TableCell>
                  <TableCell>
                    <Input type="number" placeholder="0.00" className="border-0 focus-visible:ring-1 text-right" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <Label>Narration</Label>
            <Input placeholder="Being..." />
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground flex items-center space-x-4">
              <span>Total Debit: <strong className="text-foreground">₹0.00</strong></span>
              <span>Total Credit: <strong className="text-foreground">₹0.00</strong></span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Clear (Esc)</Button>
              <Button>Save Voucher (Cmd+S)</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
