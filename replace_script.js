const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/app/dashboard/finance/po-approvals/_components/po-approvals-list-client.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(
  "import { Plus, MoreHorizontal, Pencil, Trash, Search } from 'lucide-react';",
  "import { Plus, MoreHorizontal, Pencil, Trash, Search, CheckCircle, XCircle } from 'lucide-react';"
);

content = content.replace(
  "export function PurchaseOrderListClient({ initialItems, error }: { initialItems: PurchaseOrder[], error?: string }) {",
  "export function PurchaseOrderListClient({ initialItems }: { initialItems: PurchaseOrder[] }) {"
);

const errorBlock = `{error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}`;
content = content.replace(errorBlock, "");

const handleDeleteFn = `async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const res = await deletePurchaseOrder(id);
      if (res.success) {
        toast.success('Deleted successfully');
        setItems(items.filter(i => i._id !== id));
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to delete');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }`;

const handleApproveRejectFns = `async function handleApprove(id: string) {
    try {
      const res = await updatePurchaseOrder(id, { status: 'approved' });
      if (res.success) {
        toast.success('Approved successfully');
        setItems(items.map(i => i._id === id ? { ...i, status: 'approved' } : i));
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to approve');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleReject(id: string) {
    try {
      const res = await updatePurchaseOrder(id, { status: 'rejected' });
      if (res.success) {
        toast.success('Rejected successfully');
        setItems(items.map(i => i._id === id ? { ...i, status: 'rejected' } : i));
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to reject');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }`;

content = content.replace(handleDeleteFn, handleDeleteFn + '\n\n  ' + handleApproveRejectFns);

const tableHeadReplacement = `<ZoruTableHead className="w-[80px]"></ZoruTableHead>`;
content = content.replace(tableHeadReplacement, `<ZoruTableHead className="w-[120px] text-right">Actions</ZoruTableHead>`);

const tableRowReplacement = `<ZoruTableCell>{String(item.vendorId ?? '')}</ZoruTableCell><ZoruTableCell>{String(item.totalAmount ?? '')}</ZoruTableCell><ZoruTableCell>{String(item.approvedBy ?? '')}</ZoruTableCell><ZoruTableCell>{String(item.status ?? '')}</ZoruTableCell>
                  <ZoruTableCell>
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem onClick={() => openEdit(item._id as string)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem className="text-red-600 focus:bg-red-50" onClick={() => handleDelete(item._id as string)}>
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </ZoruTableCell>`;

const newTableRow = `<ZoruTableCell>{String(item.vendorId ?? '')}</ZoruTableCell>
                  <ZoruTableCell>{String(item.totalAmount ?? '')}</ZoruTableCell>
                  <ZoruTableCell>{String(item.approvedBy ?? '')}</ZoruTableCell>
                  <ZoruTableCell>
                    <Badge variant={item.status === 'approved' ? 'default' : item.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {String(item.status ?? 'pending')}
                    </Badge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right flex items-center justify-end gap-1">
                    {item.status !== 'approved' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleApprove(item._id as string)} title="Approve">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {item.status !== 'rejected' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600" onClick={() => handleReject(item._id as string)} title="Reject">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem onClick={() => openEdit(item._id as string)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem className="text-red-600 focus:bg-red-50" onClick={() => handleDelete(item._id as string)}>
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </ZoruTableCell>`;

content = content.replace(tableRowReplacement, newTableRow);

fs.writeFileSync(filePath, content);
