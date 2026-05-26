"use client";

import React, { useState, useRef } from "react";
import { Plus, Trash, Download, Eye, FileText, Send } from "lucide-react";
import { Button } from "@/components/zoruui/button";
import { Input } from "@/components/zoruui/input";
import { Textarea } from "@/components/zoruui/textarea";
import { Label } from "@/components/zoruui/label";
import { Card } from "@/components/zoruui/card";
import { Separator } from "@/components/zoruui/separator";
import { zoruSonnerToast as toast } from "@/components/zoruui/sonner";
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
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-zoru-ink mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-zoru-brand" />
            Invoice Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                value={invoiceData.invoiceNumber}
                onChange={(e) => handleDataChange("invoiceNumber", e.target.value)}
                placeholder="INV-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={invoiceData.currency}
                onChange={(e) => handleDataChange("currency", e.target.value)}
                placeholder="USD"
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={invoiceData.date}
                onChange={(e) => handleDataChange("date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={invoiceData.dueDate}
                onChange={(e) => handleDataChange("dueDate", e.target.value)}
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <h3 className="font-medium text-zoru-ink">From (Sender)</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name / Company</Label>
                <Input
                  value={invoiceData.sender.name}
                  onChange={(e) => handleDataChange("name", e.target.value, "sender")}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={invoiceData.sender.email}
                  onChange={(e) => handleDataChange("email", e.target.value, "sender")}
                />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Textarea
                  value={invoiceData.sender.address}
                  onChange={(e) => handleDataChange("address", e.target.value, "sender")}
                  rows={3}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-medium text-zoru-ink">To (Client)</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name / Company</Label>
                <Input
                  value={invoiceData.receiver.name}
                  onChange={(e) => handleDataChange("name", e.target.value, "receiver")}
                  placeholder="Client Name"
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={invoiceData.receiver.email}
                  onChange={(e) => handleDataChange("email", e.target.value, "receiver")}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Textarea
                  value={invoiceData.receiver.address}
                  onChange={(e) => handleDataChange("address", e.target.value, "receiver")}
                  placeholder="Client Address"
                  rows={3}
                />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-zoru-ink">Line Items</h3>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
          
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="flex gap-4 items-start bg-zoru-surface-2 p-3 rounded-md">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => handleItemChange(item.id, "description", e.target.value)}
                    placeholder="Item description"
                  />
                </div>
                <div className="w-24 space-y-2">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, "quantity", Number(e.target.value))}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label className="text-xs">Rate</Label>
                  <Input
                    type="number"
                    min="0"
                    value={item.rate}
                    onChange={(e) => handleItemChange(item.id, "rate", Number(e.target.value))}
                  />
                </div>
                <div className="pt-8">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zoru-danger hover:text-zoru-danger hover:bg-zoru-danger/10"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-6" />

          <div className="flex justify-end gap-6">
            <div className="w-48 space-y-4">
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={invoiceData.discountRate}
                  onChange={(e) => handleDataChange("discountRate", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={invoiceData.taxRate}
                  onChange={(e) => handleDataChange("taxRate", Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          
          <Separator className="my-6" />
          
          <div className="space-y-2">
            <Label>Notes / Terms</Label>
            <Textarea
              value={invoiceData.notes}
              onChange={(e) => handleDataChange("notes", e.target.value)}
              rows={2}
            />
          </div>
        </Card>
      </div>

      {/* Preview Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zoru-ink flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Live Preview
          </h2>
          <div className="flex gap-2">
            <Button onClick={generatePDF} disabled={isGenerating}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        <div className="bg-zoru-surface-2 p-4 md:p-8 rounded-lg overflow-x-auto border border-zoru-line">
          {/* Invoice A4 Container */}
          <div 
            ref={previewRef}
            className="bg-white mx-auto p-10 min-w-[700px] shadow-sm text-black"
            style={{ 
              width: "210mm", 
              minHeight: "297mm", 
              fontFamily: "'Inter', sans-serif" 
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-200 pb-8 mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">INVOICE</h1>
                <p className="text-gray-500 font-medium">{invoiceData.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-gray-800">{invoiceData.sender.name}</h2>
                <p className="text-gray-500 whitespace-pre-line text-sm mt-1">{invoiceData.sender.address}</p>
                <p className="text-gray-500 text-sm">{invoiceData.sender.email}</p>
              </div>
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</h3>
                {invoiceData.receiver.name ? (
                  <>
                    <p className="font-bold text-gray-800">{invoiceData.receiver.name}</p>
                    <p className="text-gray-600 whitespace-pre-line text-sm mt-1">{invoiceData.receiver.address}</p>
                    <p className="text-gray-600 text-sm">{invoiceData.receiver.email}</p>
                  </>
                ) : (
                  <p className="text-gray-400 italic text-sm">Client details not provided</p>
                )}
              </div>
              <div className="text-right">
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Invoice Date</h3>
                  <p className="text-gray-800 font-medium">{invoiceData.date || "-"}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Due Date</h3>
                  <p className="text-gray-800 font-medium">{invoiceData.dueDate || "-"}</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full mb-8">
              <thead>
                <tr className="border-b-2 border-gray-800 text-left">
                  <th className="py-3 text-sm font-bold text-gray-800">Description</th>
                  <th className="py-3 text-sm font-bold text-gray-800 text-center w-24">Qty</th>
                  <th className="py-3 text-sm font-bold text-gray-800 text-right w-32">Rate</th>
                  <th className="py-3 text-sm font-bold text-gray-800 text-right w-32">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-4 text-sm text-gray-800">{item.description || "-"}</td>
                    <td className="py-4 text-sm text-gray-800 text-center">{item.quantity}</td>
                    <td className="py-4 text-sm text-gray-800 text-right">{formatCurrency(item.rate)}</td>
                    <td className="py-4 text-sm text-gray-800 text-right font-medium">
                      {formatCurrency(item.quantity * item.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-12">
              <div className="w-72 space-y-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {invoiceData.discountRate > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Discount ({invoiceData.discountRate}%)</span>
                    <span className="text-red-500">-{formatCurrency(discount)}</span>
                  </div>
                )}
                {invoiceData.taxRate > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax ({invoiceData.taxRate}%)</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-3">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoiceData.notes && (
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">{invoiceData.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
