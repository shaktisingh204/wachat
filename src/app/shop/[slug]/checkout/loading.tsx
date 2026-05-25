import { CheckoutPageSkeleton } from './components/skeletons';

export default function CheckoutLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <CheckoutPageSkeleton />
    </div>
  );
}
