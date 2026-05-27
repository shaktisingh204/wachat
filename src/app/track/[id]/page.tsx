import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { notFound } from 'next/navigation';
import { Truck, Package, CheckCircle2, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  if (!ObjectId.isValid(id)) {
    return notFound();
  }

  const { db } = await connectToDatabase();
  const challan = await db.collection('crm_delivery_challans').findOne({
    _id: new ObjectId(id),
  });

  if (!challan) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-zoru-surface-2 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-zoru-line overflow-hidden">
        <div className="bg-zoru-ink px-6 py-8 text-white text-center">
          <Truck className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl font-bold tracking-tight">Shipment Tracking</h1>
          <p className="mt-2 text-white">Challan #: {challan.challanNumber}</p>
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-8 pb-8 border-b border-zoru-line">
            <div>
              <p className="text-sm text-zoru-ink font-medium">Status</p>
              <div className="mt-1 flex items-center gap-2">
                {challan.status === 'Delivered' ? (
                  <CheckCircle2 className="h-6 w-6 text-zoru-ink" />
                ) : challan.status === 'In Transit' ? (
                  <Truck className="h-6 w-6 text-zoru-ink" />
                ) : challan.status === 'Returned' ? (
                  <AlertCircle className="h-6 w-6 text-zoru-ink" />
                ) : (
                  <Package className="h-6 w-6 text-zoru-ink-muted" />
                )}
                <span className="text-2xl font-semibold text-zoru-ink">{challan.status}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-zoru-ink font-medium">Date</p>
              <p className="mt-1 text-lg font-medium text-zoru-ink">
                {new Date(challan.challanDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-zoru-surface-2 p-6 rounded-lg border border-zoru-line">
              <h3 className="text-sm font-semibold text-zoru-ink uppercase tracking-wider mb-4">Transport Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-zoru-ink">Vehicle Number</dt>
                  <dd className="text-sm font-medium text-zoru-ink mt-1">{challan.transportDetails?.vehicleNumber || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zoru-ink">Driver Name</dt>
                  <dd className="text-sm font-medium text-zoru-ink mt-1">{challan.transportDetails?.driverName || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zoru-ink">Transport Mode</dt>
                  <dd className="text-sm font-medium text-zoru-ink mt-1">{challan.transportDetails?.mode || 'Not specified'}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-zoru-surface-2 p-6 rounded-lg border border-zoru-line">
              <h3 className="text-sm font-semibold text-zoru-ink uppercase tracking-wider mb-4">Shipment Contents</h3>
              <ul className="space-y-3">
                {(challan.lineItems || []).map((item: any, i: number) => (
                  <li key={i} className="flex justify-between items-start text-sm">
                    <span className="text-zoru-ink">{item.name || item.productId}</span>
                    <span className="font-medium text-zoru-ink whitespace-nowrap ml-4">Qty: {item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-center mt-8 pt-8 border-t border-zoru-line text-sm text-zoru-ink">
            For support regarding this delivery, please contact the sender.
          </div>
        </div>
      </div>
    </div>
  );
}
