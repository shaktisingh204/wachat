import { getDeliveryChallansByIds } from '@/app/actions/crm-delivery-challans.actions';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DispatchManifestPage({
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider mb-2">Dispatch Manifest</h1>
        <p className="text-sm">Generated on: {new Date().toLocaleString()}</p>
        <p className="text-sm">Total Dispatches: {challans.length}</p>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black p-2 text-left font-semibold">S.No</th>
            <th className="border border-black p-2 text-left font-semibold">Challan #</th>
            <th className="border border-black p-2 text-left font-semibold">Date</th>
            <th className="border border-black p-2 text-left font-semibold">Customer ID</th>
            <th className="border border-black p-2 text-left font-semibold">Vehicle #</th>
            <th className="border border-black p-2 text-left font-semibold">Driver Name</th>
            <th className="border border-black p-2 text-center font-semibold">Total Items</th>
            <th className="border border-black p-2 text-left font-semibold">Receiver Sign</th>
          </tr>
        </thead>
        <tbody>
          {challans.map((challan, i) => {
            const totalQty = (challan.lineItems || []).reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
            return (
              <tr key={String(challan._id)}>
                <td className="border border-black p-2 text-center">{i + 1}</td>
                <td className="border border-black p-2">{challan.challanNumber}</td>
                <td className="border border-black p-2">{new Date(challan.challanDate).toLocaleDateString()}</td>
                <td className="border border-black p-2">{String(challan.accountId).slice(-6)}</td>
                <td className="border border-black p-2">{challan.transportDetails?.vehicleNumber || '—'}</td>
                <td className="border border-black p-2">{challan.transportDetails?.driverName || '—'}</td>
                <td className="border border-black p-2 text-center">{totalQty}</td>
                <td className="border border-black p-2"></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-16 flex justify-between text-sm">
        <div className="text-center">
          <div className="border-t border-black w-48 mx-auto pt-2">Prepared By</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-48 mx-auto pt-2">Transport/Driver Sign</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-48 mx-auto pt-2">Security/Gate Pass</div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `window.print();` }} />
    </div>
  );
}
