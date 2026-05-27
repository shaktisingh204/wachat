'use client';

import * as React from 'react';
import {
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
  Button,
  Input,
  Card,
  Label,
} from '@/components/zoruui';
import { Plus, Trash2, Calculator, Info } from 'lucide-react';

export interface CalculatorItem {
  itemId: string;
  name: string;
  hsnSac?: string;
  qty: number;
  rate: number;
  discountPercent: number;
  taxRatePercent: number; // e.g. 18 for 18% GST
}

export interface CalculationTotals {
  subTotal: number;
  discountOverall: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  tdsDeducted: number;
  tcsCollected: number;
  roundOff: number;
  grandTotal: number;
}

interface CrmStatutoryCalculatorProps {
  items: CalculatorItem[];
  onChangeItems: (items: CalculatorItem[]) => void;
  placeOfSupplyState: string; // Customer supplying state, e.g. "Maharashtra"
  companyBaseState: string; // Our company base state, e.g. "Maharashtra"
  
  // statutory configs
  tdsPercent?: number;
  onChangeTdsPercent?: (val: number) => void;
  tcsPercent?: number;
  onChangeTcsPercent?: (val: number) => void;
  discountOverallVal?: number; // overall flat discount
  onChangeDiscountOverallVal?: (val: number) => void;
  shippingCharge?: number;
  onChangeShippingCharge?: (val: number) => void;
  adjustment?: number;
  onChangeAdjustment?: (val: number) => void;

  onTotalsChange?: (totals: CalculationTotals) => void;
}

export function CrmStatutoryCalculator({
  items,
  onChangeItems,
  placeOfSupplyState,
  companyBaseState,
  tdsPercent = 0,
  onChangeTdsPercent,
  tcsPercent = 0,
  onChangeTcsPercent,
  discountOverallVal = 0,
  onChangeDiscountOverallVal,
  shippingCharge = 0,
  onChangeShippingCharge,
  adjustment = 0,
  onChangeAdjustment,
  onTotalsChange,
}: CrmStatutoryCalculatorProps) {
  // Add fresh empty row
  const handleAddRow = () => {
    const newItem: CalculatorItem = {
      itemId: `temp-${Date.now()}`,
      name: '',
      hsnSac: '',
      qty: 1,
      rate: 0,
      discountPercent: 0,
      taxRatePercent: 18, // default 18% GST
    };
    onChangeItems([...items, newItem]);
  };

  // Remove row
  const handleRemoveRow = (idx: number) => {
    const next = [...items];
    next.splice(idx, 1);
    onChangeItems(next);
  };

  // Update field inside row
  const handleUpdateRow = (idx: number, field: keyof CalculatorItem, value: any) => {
    const next = [...items];
    next[idx] = {
      ...next[idx],
      [field]: value,
    };
    onChangeItems(next);
  };

  // State-aware Tax Logic (CGST/SGST vs IGST)
  // If customer place of supply is identical to company home state -> Intra-state (CGST + SGST)
  // Else -> Inter-state (IGST)
  const isIntraState = placeOfSupplyState.toLowerCase().trim() === companyBaseState.toLowerCase().trim();

  // Run full statutory math engine
  const totals: CalculationTotals = React.useMemo(() => {
    let subTotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let cess = 0;

    items.forEach((item) => {
      const rowTotalRaw = item.qty * item.rate;
      const rowDiscount = rowTotalRaw * (item.discountPercent / 100);
      const rowTaxable = Math.max(0, rowTotalRaw - rowDiscount);
      
      subTotal += rowTaxable;

      const taxAmount = rowTaxable * (item.taxRatePercent / 100);
      if (isIntraState) {
        cgst += taxAmount / 2;
        sgst += taxAmount / 2;
      } else {
        igst += taxAmount;
      }
    });

    const netTaxable = Math.max(0, subTotal - discountOverallVal);
    
    // Statutory TDS & TCS Calculations
    const tdsDeducted = netTaxable * (tdsPercent / 100);
    const tcsCollected = netTaxable * (tcsPercent / 100);

    const totalBeforeRoundOff = netTaxable + cgst + sgst + igst + cess - tdsDeducted + tcsCollected + shippingCharge + adjustment;
    const grandTotal = Math.round(totalBeforeRoundOff);
    const roundOff = grandTotal - totalBeforeRoundOff;

    return {
      subTotal,
      discountOverall: discountOverallVal,
      cgst,
      sgst,
      igst,
      cess,
      tdsDeducted,
      tcsCollected,
      roundOff,
      grandTotal,
    };
  }, [items, isIntraState, discountOverallVal, tdsPercent, tcsPercent, shippingCharge, adjustment]);

  // Sync totals up
  React.useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange(totals);
    }
  }, [totals, onTotalsChange]);

  return (
    <div className="space-y-4">
      <Card className="p-0 border border-zoru-line overflow-hidden bg-zoru-surface">
        <div className="flex items-center justify-between border-b border-zoru-line px-4 py-3 bg-zoru-surface-2/40">
          <h4 className="text-[13px] font-semibold text-zoru-ink flex items-center gap-2">
            <Calculator className="h-4 w-4 text-zoru-ink" /> Invoice Line Items & Taxes
          </h4>
          <div className="flex items-center gap-2 text-[11px] text-zoru-ink-muted">
            <Info className="h-3.5 w-3.5" />
            Tax Treatment: {isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <ZoruTableHeader className="bg-zoru-surface-2/20 border-b border-zoru-line">
              <ZoruTableRow>
                <ZoruTableHead className="text-zoru-ink-muted text-[12px] py-2 px-3 font-semibold text-left">Item Name / HSN</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-[12px] py-2 px-3 font-semibold text-center w-[100px]">Qty</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-[12px] py-2 px-3 font-semibold text-right w-[140px]">Rate (₹)</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-[12px] py-2 px-3 font-semibold text-center w-[120px]">Discount (%)</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-[12px] py-2 px-3 font-semibold text-center w-[120px]">GST Rate (%)</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted text-[12px] py-2 px-3 font-semibold text-right w-[140px]">Amount (₹)</ZoruTableHead>
                <ZoruTableHead className="w-10 px-3" />
              </ZoruTableRow>
            </ZoruTableHeader>

            <ZoruTableBody>
              {items.map((item, idx) => {
                const amount = item.qty * item.rate * (1 - item.discountPercent / 100);
                return (
                  <ZoruTableRow key={item.itemId} className="border-b border-zoru-line hover:bg-zoru-surface-2/10">
                    {/* Item details */}
                    <ZoruTableCell className="py-2.5 px-3">
                      <div className="flex flex-col gap-1">
                        <Input
                          placeholder="Search product..."
                          value={item.name}
                          onChange={(e) => handleUpdateRow(idx, 'name', e.target.value)}
                          className="h-8 text-[12.5px]"
                        />
                        <Input
                          placeholder="HSN/SAC"
                          value={item.hsnSac ?? ''}
                          onChange={(e) => handleUpdateRow(idx, 'hsnSac', e.target.value)}
                          className="h-6 text-[10.5px] max-w-[120px] text-zoru-ink-muted bg-transparent border-dashed"
                        />
                      </div>
                    </ZoruTableCell>

                    {/* Qty */}
                    <ZoruTableCell className="py-2.5 px-3">
                      <Input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleUpdateRow(idx, 'qty', Math.max(1, Number(e.target.value)))}
                        className="h-8 text-[12.5px] text-center"
                      />
                    </ZoruTableCell>

                    {/* Rate */}
                    <ZoruTableCell className="py-2.5 px-3">
                      <Input
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={(e) => handleUpdateRow(idx, 'rate', Math.max(0, Number(e.target.value)))}
                        className="h-8 text-[12.5px] text-right"
                      />
                    </ZoruTableCell>

                    {/* Discount */}
                    <ZoruTableCell className="py-2.5 px-3">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountPercent}
                        onChange={(e) => handleUpdateRow(idx, 'discountPercent', Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="h-8 text-[12.5px] text-center"
                      />
                    </ZoruTableCell>

                    {/* GST Rate dropdown options */}
                    <ZoruTableCell className="py-2.5 px-3">
                      <select
                        className="flex h-8 w-full rounded-md border border-zoru-line bg-zoru-bg px-2 text-[12.5px] text-zoru-ink shadow-sm transition-colors focus-visible:outline-none"
                        value={item.taxRatePercent}
                        onChange={(e) => handleUpdateRow(idx, 'taxRatePercent', Number(e.target.value))}
                      >
                        <option value="0">0% Exempt</option>
                        <option value="5">5% GST</option>
                        <option value="12">12% GST</option>
                        <option value="18">18% GST</option>
                        <option value="28">28% GST</option>
                      </select>
                    </ZoruTableCell>

                    {/* Calculated row Amount */}
                    <ZoruTableCell className="py-2.5 px-3 text-right text-[12.5px] font-medium text-zoru-ink">
                      {amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </ZoruTableCell>

                    {/* Action */}
                    <ZoruTableCell className="py-2.5 px-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRow(idx)}
                        className="h-7 w-7 p-0 text-zoru-danger-ink hover:bg-zoru-danger/10"
                        disabled={items.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </Table>
        </div>

        {/* Footer Quick Add row button */}
        <div className="p-3 border-t border-zoru-line bg-zoru-surface-2/10">
          <Button variant="outline" size="sm" onClick={handleAddRow} className="h-8 gap-1 text-[12px]">
            <Plus className="h-3.5 w-3.5" /> Add Document Row
          </Button>
        </div>
      </Card>

      {/* Statutory calculations math list panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zoru-surface border border-zoru-line rounded-lg p-4 space-y-3">
          <h5 className="text-[12px] font-semibold uppercase tracking-wider text-zoru-ink-muted border-b border-zoru-line pb-1.5">
            Withholdings, Discounts & Additions
          </h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-zoru-ink-muted uppercase">TDS Withholding (%)</Label>
              <Input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={tdsPercent}
                onChange={(e) => onChangeTdsPercent?.(Number(e.target.value) || 0)}
                className="h-8 text-[12.5px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-zoru-ink-muted uppercase">TCS Collection (%)</Label>
              <Input
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={tcsPercent}
                onChange={(e) => onChangeTcsPercent?.(Number(e.target.value) || 0)}
                className="h-8 text-[12.5px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-zoru-ink-muted uppercase">Overall Discount (₹)</Label>
              <Input
                type="number"
                min="0"
                value={discountOverallVal || ''}
                onChange={(e) => onChangeDiscountOverallVal?.(Number(e.target.value) || 0)}
                className="h-8 text-[12.5px]"
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-zoru-ink-muted uppercase">Shipping Charge (₹)</Label>
              <Input
                type="number"
                min="0"
                value={shippingCharge || ''}
                onChange={(e) => onChangeShippingCharge?.(Number(e.target.value) || 0)}
                className="h-8 text-[12.5px]"
                placeholder="0"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-[11px] text-zoru-ink-muted uppercase">Adjustment (₹)</Label>
              <Input
                type="number"
                value={adjustment || ''}
                onChange={(e) => onChangeAdjustment?.(Number(e.target.value) || 0)}
                className="h-8 text-[12.5px]"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Totals Rollups */}
        <div className="bg-zoru-surface-2/40 border border-zoru-line rounded-lg p-4 space-y-2.5">
          <div className="flex justify-between text-[12.5px] text-zoru-ink">
            <span>Sub-Total (Taxable Value):</span>
            <span className="font-semibold">{totals.subTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
          </div>

          {totals.discountOverall > 0 && (
            <div className="flex justify-between text-[12.5px] text-zoru-danger-ink">
              <span>Overall Discount:</span>
              <span>-{totals.discountOverall.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          )}

          {/* India Taxes Breakdown based on states */}
          {isIntraState ? (
            <>
              <div className="flex justify-between text-[12px] text-zoru-ink-muted pl-3">
                <span>CGST (Central GST):</span>
                <span>{totals.cgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
              </div>
              <div className="flex justify-between text-[12px] text-zoru-ink-muted pl-3">
                <span>SGST (State GST):</span>
                <span>{totals.sgst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-[12px] text-zoru-ink-muted pl-3">
              <span>IGST (Integrated GST):</span>
              <span>{totals.igst.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          )}

          {shippingCharge > 0 && (
            <div className="flex justify-between text-[12.5px] text-zoru-ink">
              <span>Shipping Charge:</span>
              <span>{shippingCharge.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          )}

          {adjustment !== 0 && (
            <div className="flex justify-between text-[12.5px] text-zoru-ink">
              <span>Adjustment:</span>
              <span>{adjustment > 0 ? '+' : ''}{adjustment.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          )}

          {totals.tdsDeducted > 0 && (
            <div className="flex justify-between text-[12.5px] text-zoru-danger-ink">
              <span>Statutory TDS Withheld ({tdsPercent}%):</span>
              <span>-{totals.tdsDeducted.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          )}

          {totals.tcsCollected > 0 && (
            <div className="flex justify-between text-[12.5px] text-zoru-success-ink">
              <span>Statutory TCS Collected ({tcsPercent}%):</span>
              <span>+{totals.tcsCollected.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          )}

          <div className="flex justify-between text-[12px] text-zoru-ink-muted">
            <span>Round-Off Adjustment:</span>
            <span>{totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-[15px] font-bold text-zoru-ink border-t border-zoru-line pt-2.5 mt-2">
            <span>Grand Total (Net Receivable):</span>
            <span className="text-zoru-ink">{totals.grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
