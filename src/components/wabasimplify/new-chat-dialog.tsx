
'use client';


import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Check, ChevronsUpDown } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { countryCodes } from '@/lib/country-codes';
import { cn } from '@/lib/utils';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (waId: string) => Promise<void>;
}

export function NewChatDialog({ open, onOpenChange, onStartChat }: NewChatDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountryName, setSelectedCountryName] = useState<string>('India'); // Default to India by name
  const [openCombobox, setOpenCombobox] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;

    const country = countryCodes.find(c => c.name === selectedCountryName);
    if (!country) return;

    setLoading(true);
    // Combine country code and phone number, stripping any non-numeric chars from phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const fullWaId = `${country.code}${cleanPhone}`;
    await onStartChat(fullWaId);
    setPhoneNumber('');
    setLoading(false);
  };

  const selectedCountry = countryCodes.find(c => c.name === selectedCountryName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Select the country code and enter the phone number to start a new chat.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <div className="flex gap-2">
                  <Popover open={openCombobox} onOpenChange={setOpenCombobox} modal={true}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-[140px] justify-between"
                        type="button"
                      >
                        {selectedCountry ? `+${selectedCountry.code}` : "Select..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search country..." />
                        <CommandList className="max-h-[300px] overflow-y-auto">
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup>
                            {countryCodes.map((country) => (
                              <CommandItem
                                key={`${country.code}-${country.name}`}
                                value={`${country.name} +${country.code}`}
                                onSelect={() => {
                                  setSelectedCountryName(country.name);
                                  setOpenCombobox(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCountryName === country.name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex-1 truncate">{country.name}</span>
                                <span className="text-muted-foreground ml-2">+{country.code}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    placeholder="e.g. 9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1"
                    required
                    type="tel"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Format: {selectedCountry ? `+${selectedCountry.code} 9876543210` : 'Select country code first'}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || !phoneNumber}>
              {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Start Chat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
