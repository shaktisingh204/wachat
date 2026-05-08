import { redirect } from 'next/navigation';

export default async function EditCrmProductPage(props: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await props.params;
  redirect(`/dashboard/crm/inventory/items/${productId}/edit`);
}
