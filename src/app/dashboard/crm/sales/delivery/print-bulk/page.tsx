import { getDeliveryChallansByIds } from '@/app/actions/crm-delivery-challans.actions';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PrintBulkChallansPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const ids = sp.ids?.split(',').filter(Boolean) || [];

  if (ids.length === 0) {
    return notFound();
  }

  const challans = await getDeliveryChallansByIds(ids);

  if (challans.length === 0) {
    return notFound();
  }

  return (
    <div className="bg-white min-h-screen text-black print:p-0 p-8">
      {challans.map((challan, idx) => (
        <div key={String(challan._id)} className="print:break-after-page mb-12 print:mb-0 border p-8 print:border-none">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">Delivery Challan</h1>
              <div className="text-sm">
                <p><strong>Challan #:</strong> {challan.challanNumber}</p>
                <p><strong>Date:</strong> {new Date(challan.challanDate).toLocaleDateString()}</p>
                <p><strong>Status:</strong> {challan.status}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="font-semibold text-lg">Customer</h2>
              <p className="text-sm">Account ID: {String(challan.accountId)}</p>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-semibold text-sm uppercase text-gray-500 mb-2 border-b pb-1">Transport Details</h3>
            <div className="text-sm grid grid-cols-2 gap-4">
              <p><strong>Vehicle Number:</strong> {challan.transportDetails?.vehicleNumber || '—'}</p>
              <p><strong>Driver Name:</strong> {challan.transportDetails?.driverName || '—'}</p>
              <p><strong>Mode:</strong> {challan.transportDetails?.mode || '—'}</p>
            </div>
          </div>

          <table className="w-full text-sm mb-8 border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left font-semibold">Item</th>
                <th className="border p-2 text-right font-semibold">Qty</th>
                <th className="border p-2 text-right font-semibold">Rate</th>
                <th className="border p-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(challan.lineItems || []).map((item: any, i: number) => (
                <tr key={i}>
                  <td className="border p-2">{item.name || item.productId}</td>
                  <td className="border p-2 text-right">{item.quantity}</td>
                  <td className="border p-2 text-right">{item.rate?.toFixed(2)}</td>
                  <td className="border p-2 text-right">{(item.quantity * (item.rate || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm">
            <div>
              <div className="border-t border-black w-48 mx-auto pt-2">Authorized Signatory</div>
            </div>
            <div>
              <div className="border-t border-black w-48 mx-auto pt-2">Receiver's Signature</div>
            </div>
          </div>
        </div>
      ))}
      <script dangerouslySetInnerHTML={{ __html: `window.print();` }} />
    </div>
  );
}
