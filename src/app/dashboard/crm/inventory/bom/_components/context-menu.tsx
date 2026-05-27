'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Edit, Factory, Copy, Trash2 } from 'lucide-react';

export function RowContextMenu({ children, bomId }: { children: React.ReactNode, bomId: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => setOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div 
      onContextMenu={(e) => {
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
        setOpen(true);
      }}
      className="contents"
    >
      {children}
      {open && (
        <div 
          ref={ref}
          className="fixed z-50 min-w-[8rem] overflow-hidden rounded-md border border-zoru-line bg-white p-1 text-zoru-ink shadow-md dark:border-zoru-line dark:bg-zoru-ink dark:text-white"
          style={{ top: pos.y, left: pos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/dashboard/crm/inventory/bom/${bomId}`} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink">
            View
          </Link>
          <Link href={`/dashboard/crm/inventory/bom/${bomId}/edit`} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink">
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Link>
          <Link href={`/dashboard/crm/inventory/production-orders/new?bomId=${bomId}`} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zoru-surface-2 dark:hover:bg-zoru-ink">
            <Factory className="mr-2 h-4 w-4" /> Create Production Order
          </Link>
        </div>
      )}
    </div>
  );
}
