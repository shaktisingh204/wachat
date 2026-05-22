'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useCallback,
  useTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronLeft,
  Edit,
  Package,
  PlusCircle,
  ShoppingBag,
  Trash2,
  } from 'lucide-react';

import {
  getProductsForCatalog,
  deleteProductFromCatalog,
  listProductSets,
  } from '@/app/actions/catalog.actions';
import type { ProductSet } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { CreateCollectionDialog } from '@/components/wabasimplify/create-collection-dialog';
import { DeleteCollectionButton } from '@/components/wabasimplify/delete-collection-button';

const ProductsTable = ({
  products,
  catalogId,
  onAction,
}: {
  products: any[];
  catalogId: string;
  onAction: () => void;
}) => {
  const { toast } = useZoruToast();
  const { activeProjectId } = useProject();

  const handleDeleteProduct = async (productId: string) => {
    if (!activeProjectId) return;
    const result = await deleteProductFromCatalog(productId, activeProjectId);
    if (result.success) {
      toast({ title: 'Product deleted' });
      onAction();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <Table>
      <ZoruTableHeader>
        <ZoruTableRow>
          <ZoruTableHead className="w-20"></ZoruTableHead>
          <ZoruTableHead>Name</ZoruTableHead>
          <ZoruTableHead>Price</ZoruTableHead>
          <ZoruTableHead>Inventory</ZoruTableHead>
          <ZoruTableHead>Availability</ZoruTableHead>
          <ZoruTableHead>SKU</ZoruTableHead>
          <ZoruTableHead className="text-right">Actions</ZoruTableHead>
        </ZoruTableRow>
      </ZoruTableHeader>
      <ZoruTableBody>
        {products.length > 0 ? (
          products.map((product) => (
            <ZoruTableRow key={product.id}>
              <ZoruTableCell>
                <div className="flex h-16 w-16 items-center justify-center rounded-md bg-zoru-surface-2">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      width={64}
                      height={64}
                      className="rounded-md object-cover"
                    />
                  ) : (
                    <ShoppingBag className="h-8 w-8 text-zoru-ink-muted" />
                  )}
                </div>
              </ZoruTableCell>
              <ZoruTableCell>{product.name}</ZoruTableCell>
              <ZoruTableCell>
                {product.price
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: product.currency,
                    }).format(product.price / 100)
                  : 'N/A'}
              </ZoruTableCell>
              <ZoruTableCell>{product.inventory?.toLocaleString() || 'N/A'}</ZoruTableCell>
              <ZoruTableCell>
                <Badge variant={product.availability === 'in_stock' ? 'success' : 'secondary'}>
                  {product.availability?.replace(/_/g, ' ') || 'N/A'}
                </Badge>
              </ZoruTableCell>
              <ZoruTableCell className="font-mono text-xs">{product.retailer_id}</ZoruTableCell>
              <ZoruTableCell className="text-right">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/wachat/catalog/${catalogId}/${product.id}/edit`}>
                    <Edit className="h-4 w-4" />
                  </Link>
                </Button>
                <ZoruAlertDialog>
                  <ZoruAlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-zoru-danger" />
                    </Button>
                  </ZoruAlertDialogTrigger>
                  <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                      <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
                      <ZoruAlertDialogDescription>
                        This will permanently delete the product &quot;{product.name}&quot;.
                      </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                      <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                      <ZoruAlertDialogAction onClick={() => handleDeleteProduct(product.id)}>
                        Delete
                      </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                  </ZoruAlertDialogContent>
                </ZoruAlertDialog>
              </ZoruTableCell>
            </ZoruTableRow>
          ))
        ) : (
          <ZoruTableRow>
            <ZoruTableCell colSpan={7} className="h-24 text-center text-zoru-ink-muted">
              No products found in this catalog.
            </ZoruTableCell>
          </ZoruTableRow>
        )}
      </ZoruTableBody>
    </Table>
  );
};

const CollectionsTable = ({
  collections,
  projectId,
  catalogId,
  onAction,
}: {
  collections: ProductSet[];
  projectId: string;
  catalogId: string;
  onAction: () => void;
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateCollectionDialog
          projectId={projectId}
          catalogId={catalogId}
          onCollectionCreated={onAction}
        />
      </div>
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Collection name</ZoruTableHead>
            <ZoruTableHead>Product count</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {collections.length > 0 ? (
            collections.map((set) => (
              <ZoruTableRow key={set.id}>
                <ZoruTableCell>{set.name}</ZoruTableCell>
                <ZoruTableCell>{set.product_count}</ZoruTableCell>
                <ZoruTableCell className="text-right">
                  <DeleteCollectionButton
                    setId={set.id}
                    setName={set.name}
                    projectId={projectId}
                    onDeleted={onAction}
                  />
                </ZoruTableCell>
              </ZoruTableRow>
            ))
          ) : (
            <ZoruTableRow>
              <ZoruTableCell colSpan={3} className="h-24 text-center text-zoru-ink-muted">
                No collections found in this catalog.
              </ZoruTableCell>
            </ZoruTableRow>
          )}
        </ZoruTableBody>
      </Table>
    </div>
  );
};

export default function CatalogProductsPage() {
  const params = useParams();
  const catalogId = params.catalogId as string;
  const { activeProjectId } = useProject();

  const [tab, setTab] = useState<'products' | 'collections'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<ProductSet[]>([]);
  const [isLoading, startLoading] = useTransition();

  const fetchData = useCallback(() => {
    if (activeProjectId && catalogId) {
      startLoading(async () => {
        const [productsData, collectionsData] = await Promise.all([
          getProductsForCatalog(catalogId, activeProjectId),
          listProductSets(catalogId, activeProjectId),
        ]);
        setProducts(productsData as any);
        setCollections(collectionsData as any);
      });
    }
  }, [activeProjectId, catalogId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading && products.length === 0 && collections.length === 0) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/catalog">Catalog</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Products</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/wachat/catalog">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to catalogs
        </Link>
      </Button>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <ShoppingBag className="h-7 w-7" />
              Catalog management
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Manage products and collections within your catalog.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <div className="flex gap-1 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-1 sm:w-fit">
        {(['products', 'collections'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-[var(--zoru-radius-sm)] px-4 py-1.5 text-sm transition-colors',
              tab === id
                ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                : 'text-zoru-ink-muted hover:text-zoru-ink',
            )}
          >
            {id === 'products' ? <ShoppingBag className="h-4 w-4" /> : <Package className="h-4 w-4" />}
            {id === 'products' ? 'Products' : 'Collections'}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <Card>
          <ZoruCardHeader>
            <div className="flex items-center justify-between">
              <div>
                <ZoruCardTitle>Products</ZoruCardTitle>
                <ZoruCardDescription>A list of products in this catalog.</ZoruCardDescription>
              </div>
              <Button asChild>
                <Link href={`/wachat/catalog/new?catalogId=${catalogId}`}>
                  <PlusCircle className="mr-1 h-4 w-4" /> Add product
                </Link>
              </Button>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent>
            {activeProjectId && (
              <ProductsTable
                products={products}
                catalogId={catalogId}
                onAction={fetchData}
              />
            )}
          </ZoruCardContent>
        </Card>
      )}

      {tab === 'collections' && (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Collections (product sets)</ZoruCardTitle>
            <ZoruCardDescription>
              Group products into sets for ads and promotions.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {activeProjectId && (
              <CollectionsTable
                collections={collections}
                projectId={activeProjectId}
                catalogId={catalogId}
                onAction={fetchData}
              />
            )}
          </ZoruCardContent>
        </Card>
      )}
    </div>
  );
}
