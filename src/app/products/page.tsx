import type { Metadata } from 'next';
import ProductsClient from './ProductsClient';

export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  title: 'Products | SabNode',
  description: 'Explore the SabNode product suite for conversations, automation, CRM, campaigns, commerce, and analytics.',
};

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-white text-black font-mono selection:bg-black selection:text-white">
      {/* Header */}
      <header className="border-b border-black p-6 flex justify-between items-center bg-white sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-black flex items-center justify-center">
             <div className="w-4 h-4 bg-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase">SabNode Products</h1>
        </div>
        <div className="flex items-center space-x-4">
           <a href="/" className="text-sm font-bold uppercase hover:underline">Back to Home</a>
           <div className="text-sm border border-black px-3 py-1 bg-black text-white font-bold">
             v2.0.0
           </div>
        </div>
      </header>

      <ProductsClient />
    </main>
  );
}
