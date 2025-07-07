
'use client';

import { getEcommShopById, applyEcommShopTheme } from '@/app/actions/custom-ecommerce.actions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithId, EcommShop } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { ArrowLeft, Bot, Brush, Package, Settings, ShoppingBag, Wand, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';


const navItems = [
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/website-builder", label: "Website Builder", icon: Brush },
    { href: "/products", label: "Products", icon: ShoppingBag },
    { href: "/orders", label: "Orders", icon: Package },
    { href: "/flow-builder", label: "Chat Bot", icon: Bot },
];

function LayoutSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

export default function ShopManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const { toast } = useToast();
    const shopId = params.shopId as string;
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApplyingTheme, startThemeTransition] = useTransition();

    useEffect(() => {
        if (shopId) {
            getEcommShopById(shopId).then(data => {
                setShop(data);
                setIsLoading(false);
            });
        }
    }, [shopId]);
    
    const isWebsiteBuilderPage = pathname.includes('/website-builder');

    if (isLoading) {
        return <LayoutSkeleton />;
    }

    if (!shop) {
        return <div>Shop not found.</div>;
    }
    
    const handleApplyTheme = async () => {
        startThemeTransition(async () => {
            const result = await applyEcommShopTheme(shop._id.toString());
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Theme Applied!', description: result.message });
                // Refresh the builder page to show new layout
                if (isWebsiteBuilderPage) {
                    router.refresh();
                }
            }
        });
    };

    if (isWebsiteBuilderPage) {
        return <>{children}</>;
    }
    
    const basePath = `/dashboard/facebook/custom-ecommerce/manage/${shopId}`;

    return (
        <div className="flex flex-col gap-8">
            <div>
                 <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/facebook/custom-ecommerce">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Shops
                    </Link>
                </Button>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">{shop.name}</h1>
                        <p className="text-muted-foreground">Manage your custom e-commerce shop.</p>
                    </div>
                    <Button onClick={handleApplyTheme} disabled={isApplyingTheme} variant="outline">
                        {isApplyingTheme ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Wand className="mr-2 h-4 w-4"/>}
                        Apply Default Theme
                    </Button>
                </div>
            </div>
            <nav>
                <ul className="flex items-center gap-2 border-b">
                    {navItems.map(item => (
                        <li key={item.href}>
                            <Button asChild variant="ghost" className={cn("rounded-b-none border-b-2 border-transparent", pathname === `${basePath}${item.href}` && 'border-primary text-primary')}>
                                <Link href={`${basePath}${item.href}`}>
                                    <item.icon className="mr-2 h-4 w-4" />
                                    {item.label}
                                </Link>
                            </Button>
                        </li>
                    ))}
                </ul>
            </nav>
            <div>
                {children}
            </div>
        </div>
    );
}

    