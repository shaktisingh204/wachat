'use client';

import React, { useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Field,
  Input,
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Button,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { ScanLine } from 'lucide-react';

const TODAY = new Date().toISOString().split('T')[0];

export default function VouchersPage() {
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcut for saving the voucher.
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        toast.success('Voucher saved');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toast]);

  const handleSave = () => {
    toast.success('Voucher saved');
  };

  return (
    <div className="ui20 p-6 space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Voucher Entry</PageTitle>
          <PageDescription>
            Fast, keyboard-first data entry. Use Tab and Shift+Tab to navigate. Cmd+S to save.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <span className="text-sm font-medium text-[var(--st-text-secondary)]">Active editors</span>
          <AvatarGroup max={2} size="sm" label="2 active editors, plus 2 more">
            <Avatar>
              <AvatarImage src="https://i.pravatar.cc/100?img=1" alt="Editor A" />
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarImage src="https://i.pravatar.cc/100?img=2" alt="Editor B" />
              <AvatarFallback>B</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>C</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>D</AvatarFallback>
            </Avatar>
          </AvatarGroup>
        </PageActions>
      </PageHeader>

      <Card variant="outlined" className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine size={18} aria-hidden="true" />
            AI Zero-Data Entry (OCR)
          </CardTitle>
          <CardDescription>
            Pick a receipt or invoice from SabFiles and AI will auto-fill the voucher below.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <SabFilePickerButton
            accept="all"
            variant="outline"
            onPick={(pick) => {
              toast.info(`Scanning ${pick.name ?? 'file'} for voucher data`);
            }}
          >
            Choose receipt or invoice
          </SabFilePickerButton>
        </CardBody>
      </Card>

      <Card variant="outlined" className="max-w-4xl">
        <CardHeader>
          <CardTitle>New Voucher</CardTitle>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Voucher Type">
              <Select defaultValue="journal">
                <SelectTrigger aria-label="Voucher type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipt">Receipt (F6)</SelectItem>
                  <SelectItem value="payment">Payment (F5)</SelectItem>
                  <SelectItem value="journal">Journal (F7)</SelectItem>
                  <SelectItem value="contra">Contra (F4)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Date">
              <Input type="date" defaultValue={TODAY} />
            </Field>

            <Field label="Voucher No.">
              <Input type="text" placeholder="Auto-generated" disabled />
            </Field>
          </div>

          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] overflow-hidden">
            <Table hover={false}>
              <THead>
                <Tr>
                  <Th width={100}>Dr/Cr</Th>
                  <Th>Particulars (Ledger Account)</Th>
                  <Th align="right">Debit (₹)</Th>
                  <Th align="right">Credit (₹)</Th>
                </Tr>
              </THead>
              <TBody>
                <Tr>
                  <Td>
                    <Select defaultValue="dr">
                      <SelectTrigger aria-label="Debit or credit, row 1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dr">Dr</SelectItem>
                        <SelectItem value="cr">Cr</SelectItem>
                      </SelectContent>
                    </Select>
                  </Td>
                  <Td>
                    <Field label="Ledger, row 1" className="sr-only">
                      <Input placeholder="Search Ledger (Alt+L)..." autoFocus />
                    </Field>
                  </Td>
                  <Td align="right">
                    <Field label="Debit amount, row 1" className="sr-only">
                      <Input type="number" placeholder="0.00" className="text-right" />
                    </Field>
                  </Td>
                  <Td align="right">
                    <Field label="Credit amount, row 1" className="sr-only">
                      <Input type="number" placeholder="0.00" className="text-right" disabled />
                    </Field>
                  </Td>
                </Tr>
                <Tr>
                  <Td>
                    <Select defaultValue="cr">
                      <SelectTrigger aria-label="Debit or credit, row 2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dr">Dr</SelectItem>
                        <SelectItem value="cr">Cr</SelectItem>
                      </SelectContent>
                    </Select>
                  </Td>
                  <Td>
                    <Field label="Ledger, row 2" className="sr-only">
                      <Input placeholder="Search Ledger (Alt+L)..." />
                    </Field>
                  </Td>
                  <Td align="right">
                    <Field label="Debit amount, row 2" className="sr-only">
                      <Input type="number" placeholder="0.00" className="text-right" disabled />
                    </Field>
                  </Td>
                  <Td align="right">
                    <Field label="Credit amount, row 2" className="sr-only">
                      <Input type="number" placeholder="0.00" className="text-right" />
                    </Field>
                  </Td>
                </Tr>
              </TBody>
            </Table>
          </div>

          <Field label="Narration">
            <Input placeholder="Being..." />
          </Field>
        </CardBody>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm text-[var(--st-text-secondary)]">
            <span>
              Total Debit: <strong className="text-[var(--st-text)]">₹0.00</strong>
            </span>
            <span>
              Total Credit: <strong className="text-[var(--st-text)]">₹0.00</strong>
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Clear (Esc)</Button>
            <Button variant="primary" onClick={handleSave}>
              Save Voucher (Cmd+S)
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
