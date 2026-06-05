'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  IconButton,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Tabs,
  useToast,
} from '@/components/sabcrm/20ui';
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
import { CreateCollectionDialog } from '@/components/zoruui-domain/create-collection-dialog';
import { DeleteCollectionButton } from '@/components/zoruui-domain/delete-collection-button';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

const ProductsTable = ({
  products,
  catalogId,
  onAction,
}: {
  products: any[];
  catalogId: string;
  onAction: () => void;
}) => {
  const { toast } = useToast();
  const { activeProjectId } = useProject();

  const handleDeleteProduct = async (productId: string) => {
    if (!activeProjectId) return;
    const result = await deleteProductFromCatalog(productId, activeProjectId);
    if (result.success) {
      toast({ title: 'Product deleted', tone: 'success' });
      onAction();
    } else {
      toast({ title: 'Error', description: result.error, tone: 'danger' });
    }
  };

  return (
    <Table>
      <THead>
        <Tr>
          <Th width={80}></Th>
          <Th>Name</Th>
          <Th>Price</Th>
          <Th>Inventory</Th>
          <Th>Availability</Th>
          <Th>SKU</Th>
          <Th align="right">Actions</Th>
        </Tr>
      </THead>
      <TBody>
        {products.length > 0 ? (
          products.map((product) => (
            <Tr key={product.id}>
              <Td>
                <div
                  className="flex h-16 w-16 items-center justify-center"
                  style={{
                    background: 'var(--st-bg-secondary)',
                    borderRadius: 'var(--st-radius)',
                  }}
                >
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      width={64}
                      height={64}
                      className="object-cover"
                      style={{ borderRadius: 'var(--st-radius)' }}
                    />
                  ) : (
                    <ShoppingBag
                      className="h-8 w-8"
                      style={{ color: 'var(--st-text-tertiary)' }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </Td>
              <Td>{product.name}</Td>
              <Td>
                {product.price
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: product.currency,
                    }).format(product.price / 100)
                  : 'N/A'}
              </Td>
              <Td>{product.inventory?.toLocaleString() || 'N/A'}</Td>
              <Td>
                <Badge tone={product.availability === 'in_stock' ? 'success' : 'neutral'}>
                  {product.availability?.replace(/_/g, ' ') || 'N/A'}
                </Badge>
              </Td>
              <Td className="font-mono text-xs">{product.retailer_id}</Td>
              <Td align="right">
                <div className="inline-flex items-center justify-end gap-1">
                  <Link
                    href={`/wachat/catalog/${catalogId}/${product.id}/edit`}
                    className="u-btn u-icon-btn u-btn--ghost u-icon-btn--md"
                    aria-label={`Edit ${product.name}`}
                  >
                    <Edit size={14} aria-hidden="true" />
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <IconButton
                        label={`Delete ${product.name}`}
                        icon={Trash2}
                        variant="ghost"
                      />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the product &quot;{product.name}&quot;.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteProduct(product.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Td>
            </Tr>
          ))
        ) : (
          <Tr>
            <Td colSpan={7}>
              <EmptyState
                icon={ShoppingBag}
                title="No products found"
                description="No products found in this catalog."
              />
            </Td>
          </Tr>
        )}
      </TBody>
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
        <THead>
          <Tr>
            <Th>Collection name</Th>
            <Th>Product count</Th>
            <Th align="right">Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {collections.length > 0 ? (
            collections.map((set) => (
              <Tr key={set.id}>
                <Td>{set.name}</Td>
                <Td>{set.product_count}</Td>
                <Td align="right">
                  <DeleteCollectionButton
                    setId={set.id}
                    setName={set.name}
                    projectId={projectId}
                    onDeleted={onAction}
                  />
                </Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={3}>
                <EmptyState
                  icon={Package}
                  title="No collections found"
                  description="No collections found in this catalog."
                />
              </Td>
            </Tr>
          )}
        </TBody>
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

  const breadcrumb = [
    { label: 'SabNode', href: '/dashboard' },
    { label: 'WaChat', href: '/wachat' },
    { label: 'Catalog', href: '/wachat/catalog' },
    { label: 'Products' },
  ];

  if (isLoading && products.length === 0 && collections.length === 0) {
    return (
      <WachatPage
        breadcrumb={breadcrumb}
        eyebrow="Catalog"
        title="Catalog management"
        description="Manage products and collections within your catalog."
        width="wide"
      >
        <Skeleton height={384} width="100%" />
      </WachatPage>
    );
  }

  return (
    <WachatPage
      breadcrumb={breadcrumb}
      eyebrow="Catalog"
      title="Catalog management"
      description="Manage products and collections within your catalog."
      width="wide"
      actions={
        <Link
          href="/wachat/catalog"
          className="u-btn u-btn--ghost u-btn--sm"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          <span className="u-btn__label">Back to catalogs</span>
        </Link>
      }
    >
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as 'products' | 'collections')}
        items={[
          { value: 'products', label: 'Products', icon: ShoppingBag },
          { value: 'collections', label: 'Collections', icon: Package },
        ]}
      />

      {tab === 'products' && (
        <Card padding="none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Products</CardTitle>
                <CardDescription>A list of products in this catalog.</CardDescription>
              </div>
              <Link
                href={`/wachat/catalog/new?catalogId=${catalogId}`}
                className="u-btn u-btn--primary u-btn--md"
              >
                <PlusCircle size={14} aria-hidden="true" />
                <span className="u-btn__label">Add product</span>
              </Link>
            </div>
          </CardHeader>
          <CardBody>
            {activeProjectId && (
              <ProductsTable
                products={products}
                catalogId={catalogId}
                onAction={fetchData}
              />
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'collections' && (
        <Card padding="none">
          <CardHeader>
            <CardTitle>Collections (product sets)</CardTitle>
            <CardDescription>
              Group products into sets for ads and promotions.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {activeProjectId && (
              <CollectionsTable
                collections={collections}
                projectId={activeProjectId}
                catalogId={catalogId}
                onAction={fetchData}
              />
            )}
          </CardBody>
        </Card>
      )}
    </WachatPage>
  );
}
