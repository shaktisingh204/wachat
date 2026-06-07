"use client";

import React, { useState, useRef } from "react";
import { Plus, Trash, Download, Eye, FileText } from "lucide-react";
import {
  Button,
  IconButton,
  Card,
  CardBody,
  Field,
  Input,
  Textarea,
  Separator,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  toast,
} from "@/components/sabcrm/20ui";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export function InvoiceGenerator() {
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: "INV-001",
    date: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    currency: "USD",
    taxRate: 0,
    discountRate: 0,
    notes: "Thank you for your business!",
    sender: {
      name: "SabNode Inc.",
      email: "billing@sabnode.com",
      address: "123 Business Ave, Suite 100\nSan Francisco, CA 94107",
    },
    receiver: {
      name: "",
      email: "",
      address: "",
    },
  });

  const [items, setItems] = useState([
    { id: "1", description: "Web Development", quantity: 1, rate: 1000 },
  ]);

  const previewRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDataChange = (field: string, value: any, section?: "sender" | "receiver") => {
    if (section) {
      setInvoiceData((prev) => ({
        ...prev,
        [section]: { ...prev[section], [field]: value },
      }));
    } else {
      setInvoiceData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleItemChange = (id: string, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), description: "", quantity: 1, rate: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.rate, 0);
  const discount = (subtotal * invoiceData.discountRate) / 100;
  const taxableAmount = subtotal - discount;
  const tax = (taxableAmount * invoiceData.taxRate) / 100;
  const total = taxableAmount + tax;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoiceData.currency,
    }).format(amount);
  };

  const generatePDF = async () => {
    if (!previewRef.current) return;

    try {
      setIsGenerating(true);
      toast.info("Generating PDF...");

      const element = previewRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${invoiceData.invoiceNumber}.pdf`);

      toast.success("PDF generated successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Editor Section */}
      <div className="flex flex-col gap-6">
        <Card padding="lg">
          <CardBody>
            <h2 className="text-lg font-semibold text-[var(--st-text)] mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
              Invoice Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Invoice Number">
                <Input
                  value={invoiceData.invoiceNumber}
                  onChange={(e) => handleDataChange("invoiceNumber", e.target.value)}
                  placeholder="INV-001"
                />
              </Field>
              <Field label="Currency">
                <Input
                  value={invoiceData.currency}
                  onChange={(e) => handleDataChange("currency", e.target.value)}
                  placeholder="USD"
                />
              </Field>
              <Field label="Date">
                <Input
                  type="date"
                  value={invoiceData.date}
                  onChange={(e) => handleDataChange("date", e.target.value)}
                />
              </Field>
              <Field label="Due Date">
                <Input
                  type="date"
                  value={invoiceData.dueDate}
                  onChange={(e) => handleDataChange("dueDate", e.target.value)}
                />
              </Field>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card padding="lg">
            <CardBody>
              <h3 className="font-medium text-[var(--st-text)] mb-4">From (Sender)</h3>
              <div className="flex flex-col gap-3">
                <Field label="Name / Company">
                  <Input
                    value={invoiceData.sender.name}
                    onChange={(e) => handleDataChange("name", e.target.value, "sender")}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={invoiceData.sender.email}
                    onChange={(e) => handleDataChange("email", e.target.value, "sender")}
                  />
                </Field>
                <Field label="Address">
                  <Textarea
                    value={invoiceData.sender.address}
                    onChange={(e) => handleDataChange("address", e.target.value, "sender")}
                    rows={3}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card padding="lg">
            <CardBody>
              <h3 className="font-medium text-[var(--st-text)] mb-4">To (Client)</h3>
              <div className="flex flex-col gap-3">
                <Field label="Name / Company">
                  <Input
                    value={invoiceData.receiver.name}
                    onChange={(e) => handleDataChange("name", e.target.value, "receiver")}
                    placeholder="Client Name"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={invoiceData.receiver.email}
                    onChange={(e) => handleDataChange("email", e.target.value, "receiver")}
                    placeholder="client@example.com"
                  />
                </Field>
                <Field label="Address">
                  <Textarea
                    value={invoiceData.receiver.address}
                    onChange={(e) => handleDataChange("address", e.target.value, "receiver")}
                    placeholder="Client Address"
                    rows={3}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card padding="lg">
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-[var(--st-text)]">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addItem} iconLeft={Plus}>
                Add Item
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 items-start bg-[var(--st-bg-secondary)] p-3 rounded-[var(--st-radius)]"
                >
                  <div className="flex-1">
                    <Field label="Description">
                      <Input
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                        placeholder="Item description"
                      />
                    </Field>
                  </div>
                  <div className="w-24">
                    <Field label="Qty">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, "quantity", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <div className="w-32">
                    <Field label="Rate">
                      <Input
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={(e) => handleItemChange(item.id, "rate", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <div className="pt-8">
                    <IconButton
                      label="Remove item"
                      icon={Trash}
                      variant="danger"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-6" />

            <div className="flex justify-end gap-6">
              <div className="w-48 flex flex-col gap-4">
                <Field label="Discount (%)">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={invoiceData.discountRate}
                    onChange={(e) => handleDataChange("discountRate", Number(e.target.value))}
                  />
                </Field>
                <Field label="Tax (%)">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={invoiceData.taxRate}
                    onChange={(e) => handleDataChange("taxRate", Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            <Separator className="my-6" />

            <Field label="Notes / Terms">
              <Textarea
                value={invoiceData.notes}
                onChange={(e) => handleDataChange("notes", e.target.value)}
                rows={2}
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      {/* Preview Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-2">
            <Eye className="w-5 h-5" aria-hidden="true" />
            Live Preview
          </h2>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={generatePDF}
              loading={isGenerating}
              iconLeft={Download}
            >
              Download PDF
            </Button>
          </div>
        </div>

        <div className="bg-[var(--st-bg-secondary)] p-4 md:p-8 rounded-[var(--st-radius)] overflow-x-auto border border-[var(--st-border)]">
          {/* Invoice A4 Container. A fixed white paper artifact (html2canvas
              captures it for the PDF), so it uses static neutral ink colours,
              not the app theme tokens, to stay legible on white in any mode. */}
          <div
            ref={previewRef}
            className="bg-white mx-auto p-10 min-w-[700px] w-[210mm] min-h-[297mm] shadow-sm text-neutral-900 font-[Inter,sans-serif]"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-neutral-200 pb-8 mb-8">
              <div>
                <h1 className="text-4xl font-bold text-neutral-900 mb-2">INVOICE</h1>
                <p className="text-neutral-900 font-medium">{invoiceData.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-neutral-900">{invoiceData.sender.name}</h2>
                <p className="text-neutral-600 whitespace-pre-line text-sm mt-1">{invoiceData.sender.address}</p>
                <p className="text-neutral-600 text-sm">{invoiceData.sender.email}</p>
              </div>
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Billed To</h3>
                {invoiceData.receiver.name ? (
                  <>
                    <p className="font-bold text-neutral-900">{invoiceData.receiver.name}</p>
                    <p className="text-neutral-600 whitespace-pre-line text-sm mt-1">{invoiceData.receiver.address}</p>
                    <p className="text-neutral-600 text-sm">{invoiceData.receiver.email}</p>
                  </>
                ) : (
                  <p className="text-neutral-400 italic text-sm">Client details not provided</p>
                )}
              </div>
              <div className="text-right">
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Invoice Date</h3>
                  <p className="text-neutral-900 font-medium">{invoiceData.date || "-"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Due Date</h3>
                  <p className="text-neutral-900 font-medium">{invoiceData.dueDate || "-"}</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <Table hover={false} className="mb-8">
              <THead>
                <Tr>
                  <Th>Description</Th>
                  <Th align="center" width={96}>Qty</Th>
                  <Th align="right" width={128}>Rate</Th>
                  <Th align="right" width={128}>Amount</Th>
                </Tr>
              </THead>
              <TBody>
                {items.map((item) => (
                  <Tr key={item.id}>
                    <Td>{item.description || "-"}</Td>
                    <Td align="center">{item.quantity}</Td>
                    <Td align="right">{formatCurrency(item.rate)}</Td>
                    <Td align="right" className="font-medium">
                      {formatCurrency(item.quantity * item.rate)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>

            {/* Totals */}
            <div className="flex justify-end mb-12">
              <div className="w-72 flex flex-col gap-3">
                <div className="flex justify-between text-sm text-neutral-700">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {invoiceData.discountRate > 0 && (
                  <div className="flex justify-between text-sm text-neutral-700">
                    <span>Discount ({invoiceData.discountRate}%)</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                {invoiceData.taxRate > 0 && (
                  <div className="flex justify-between text-sm text-neutral-700">
                    <span>Tax ({invoiceData.taxRate}%)</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-neutral-900 border-t border-neutral-200 pt-3">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoiceData.notes && (
              <div className="border-t border-neutral-200 pt-8">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-sm text-neutral-700 whitespace-pre-line">{invoiceData.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
