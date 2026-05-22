"use client";

import React, { useState } from "react";
import { 
  Search, Filter, PhoneCall, MessageSquare, 
  Image as ImageIcon, Globe, RefreshCcw, 
  ShoppingCart, Info, CheckCircle2, ChevronDown, 
  SlidersHorizontal, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PhoneNumber {
  id: string;
  number: string;
  friendlyName: string;
  country: string;
  region: string;
  type: "Local" | "Mobile" | "Toll-Free";
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
  };
  monthlyPrice: number;
  setupFee: number;
  currency: string;
}

const DUMMY_INVENTORY: PhoneNumber[] = [
  {
    id: "num_1",
    number: "+14155552671",
    friendlyName: "(415) 555-2671",
    country: "US",
    region: "California",
    type: "Local",
    capabilities: { voice: true, sms: true, mms: true, fax: false },
    monthlyPrice: 1.15,
    setupFee: 0,
    currency: "USD",
  },
  {
    id: "num_2",
    number: "+14155553902",
    friendlyName: "(415) 555-3902",
    country: "US",
    region: "California",
    type: "Local",
    capabilities: { voice: true, sms: true, mms: false, fax: false },
    monthlyPrice: 1.15,
    setupFee: 0,
    currency: "USD",
  },
  {
    id: "num_3",
    number: "+18005550199",
    friendlyName: "800-555-0199",
    country: "US",
    region: "Toll-Free",
    type: "Toll-Free",
    capabilities: { voice: true, sms: false, mms: false, fax: true },
    monthlyPrice: 2.15,
    setupFee: 5.00,
    currency: "USD",
  },
  {
    id: "num_4",
    number: "+447700900077",
    friendlyName: "+44 7700 900077",
    country: "GB",
    region: "London",
    type: "Mobile",
    capabilities: { voice: true, sms: true, mms: false, fax: false },
    monthlyPrice: 2.50,
    setupFee: 0,
    currency: "USD",
  },
  {
    id: "num_5",
    number: "+61491570156",
    friendlyName: "+61 491 570 156",
    country: "AU",
    region: "Sydney",
    type: "Mobile",
    capabilities: { voice: true, sms: true, mms: true, fax: false },
    monthlyPrice: 3.50,
    setupFee: 0,
    currency: "USD",
  },
  {
    id: "num_6",
    number: "+12125559988",
    friendlyName: "(212) 555-9988",
    country: "US",
    region: "New York",
    type: "Local",
    capabilities: { voice: true, sms: true, mms: true, fax: false },
    monthlyPrice: 1.15,
    setupFee: 0,
    currency: "USD",
  },
];

export default function BuyNumbersPage() {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<PhoneNumber[]>(DUMMY_INVENTORY);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 800);
  };

  const toggleNumberSelection = (id: string) => {
    const newSelection = new Set(selectedNumbers);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedNumbers(newSelection);
  };

  const selectAll = () => {
    if (selectedNumbers.size === results.length) {
      setSelectedNumbers(new Set());
    } else {
      setSelectedNumbers(new Set(results.map(r => r.id)));
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-neutral-50/50 dark:bg-neutral-950">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Buy Numbers</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Search and provision phone numbers from over 100 countries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Refresh Inventory
          </Button>
          <Button className="gap-2" disabled={selectedNumbers.size === 0}>
            <ShoppingCart className="h-4 w-4" />
            Buy Selected ({selectedNumbers.size})
          </Button>
        </div>
      </div>

      {/* Dense Search Interface */}
      <Card className="border-neutral-200 dark:border-neutral-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-neutral-500" />
            <CardTitle className="text-lg">Advanced Search</CardTitle>
          </div>
          <CardDescription>Use granular filters to find the exact numbers you need.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="space-y-3">
              <Label>Country</Label>
              <Select defaultValue="us">
                <SelectTrigger>
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">🇺🇸 United States (+1)</SelectItem>
                  <SelectItem value="gb">🇬🇧 United Kingdom (+44)</SelectItem>
                  <SelectItem value="au">🇦🇺 Australia (+61)</SelectItem>
                  <SelectItem value="ca">🇨🇦 Canada (+1)</SelectItem>
                  <SelectItem value="in">🇮🇳 India (+91)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <Label>Number Type</Label>
              <Select defaultValue="any">
                <SelectTrigger>
                  <SelectValue placeholder="Any Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Type</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="toll-free">Toll-Free</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Search by Digits or Phrases</Label>
              <div className="flex w-full items-center space-x-2">
                <Input type="text" placeholder="e.g. 415 or CODE" className="flex-1" />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Match Criteria</Label>
              <Select defaultValue="anywhere">
                <SelectTrigger>
                  <SelectValue placeholder="Match Anywhere" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anywhere">Match Anywhere</SelectItem>
                  <SelectItem value="start">Starts With</SelectItem>
                  <SelectItem value="end">Ends With</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <Label className="mb-3 block">Required Capabilities</Label>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox id="cap-voice" defaultChecked />
                <label
                  htmlFor="cap-voice"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                >
                  <PhoneCall className="h-4 w-4 text-blue-500" />
                  Voice
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cap-sms" defaultChecked />
                <label
                  htmlFor="cap-sms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4 text-green-500" />
                  SMS
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cap-mms" />
                <label
                  htmlFor="cap-mms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                >
                  <ImageIcon className="h-4 w-4 text-purple-500" />
                  MMS
                </label>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-neutral-50 dark:bg-neutral-900/50 flex justify-between items-center py-4 border-t border-neutral-100 dark:border-neutral-800 rounded-b-xl">
          <Button variant="ghost" className="text-neutral-500">
            Clear Filters
          </Button>
          <Button onClick={handleSearch} disabled={isSearching} className="gap-2 min-w-[120px]">
            {isSearching ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
        </CardFooter>
      </Card>

      {/* Results Table */}
      <Card className="border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Available Inventory</CardTitle>
              <CardDescription>Showing {results.length} results matching your criteria.</CardDescription>
            </div>
            <Select defaultValue="10">
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Results per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50/50 dark:bg-neutral-900/20 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20">
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectedNumbers.size === results.length && results.length > 0}
                    onCheckedChange={selectAll}
                  />
                </TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead className="text-right">Price (Monthly)</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32 text-neutral-500">
                    No numbers found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell>
                      <Checkbox 
                        checked={selectedNumbers.has(item.id)}
                        onCheckedChange={() => toggleNumberSelection(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        {item.friendlyName}
                      </div>
                      <div className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                        <Globe className="h-3 w-3" />
                        {item.country}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal text-xs">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {item.region}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {item.capabilities.voice && (
                          <div className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 p-1.5 rounded-md" title="Voice">
                            <PhoneCall className="h-3.5 w-3.5" />
                          </div>
                        )}
                        {item.capabilities.sms && (
                          <div className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 p-1.5 rounded-md" title="SMS">
                            <MessageSquare className="h-3.5 w-3.5" />
                          </div>
                        )}
                        {item.capabilities.mms && (
                          <div className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 p-1.5 rounded-md" title="MMS">
                            <ImageIcon className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">${item.monthlyPrice.toFixed(2)}</div>
                      {item.setupFee > 0 && (
                        <div className="text-xs text-neutral-500">
                          +${item.setupFee.toFixed(2)} setup
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant={selectedNumbers.has(item.id) ? "secondary" : "default"} 
                        size="sm" 
                        className="w-full"
                        onClick={() => toggleNumberSelection(item.id)}
                      >
                        {selectedNumbers.has(item.id) ? "Selected" : "Add"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
