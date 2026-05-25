import { getEcommShopBySlug } from '@/app/actions/custom-ecommerce.actions';
import { notFound } from 'next/navigation';
import { CheckoutForm } from './checkout-form';

export async function CheckoutContent({ slug }: { slug: string }) {
  const shop = await getEcommShopBySlug(slug);
  
  if (!shop) {
    notFound();
  }

  const currency = shop.currency || 'INR';

  return (
    <CheckoutForm currency={currency} />
  );
}
