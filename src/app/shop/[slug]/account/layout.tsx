
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Heart,
  User,
  MapPin,
  LogOut,
  ChevronLeft,
  Download,
  GitCompare,
  ArrowRightLeft,
  Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/profile', label: 'Profile Details', icon: User },
  { href: '/address-book', label: 'Address Book', icon: MapPin },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/returns', label: 'Returns', icon: ArrowRightLeft },
  { href: '/downloads', label: 'Downloads', icon: Download },
  { href: '/compare', label: 'Compare', icon: GitCompare },
];

export default function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const pathname = usePathname();
  const basePath = `/shop/${params.slug}/account`;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-12 gap-8">
        <aside className="md:col-span-3">
          <nav className="flex flex-col space-y-2">
            {navItems.map((item) => {
              const fullPath = `${basePath}${item.href}`;
              const isActive = item.href === '' ? pathname === fullPath : pathname.startsWith(fullPath);
              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? 'default' : 'ghost'}
                  className="justify-start"
                >
                  <Link href={fullPath}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
             <Button
              asChild
              variant="ghost"
              className="justify-start"
            >
                <Link href={`/shop/${params.slug}/account/login`}>
                    <Key className="mr-2 h-4 w-4" />
                    Login / Register
                </Link>
            </Button>
             <Button
              variant="ghost"
              className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
            </Button>
          </nav>
        </aside>
        <main className="md:col-span-9">{children}</main>
      </div>
    </div>
  );
}
