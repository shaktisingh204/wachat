"use client";

import React, { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { searchNumbers, getRecommendedNumbers, checkoutNumbers, PhoneNumber } from "./actions";

export default function BuyNumbersPage() {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<PhoneNumber[]>([]);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Filters State
  const [country, setCountry] = useState("us");
  const [numberType, setNumberType] = useState("any");
  const [searchPhrase, setSearchPhrase] = useState("");
  const [matchCriteria, setMatchCriteria] = useState("anywhere");
  
  const [capVoice, setCapVoice] = useState(true);
  const [capSms, setCapSms] = useState(true);
  const [capMms, setCapMms] = useState(false);

  useEffect(() => {
    // Recommend numbers based on user's highest traffic regions on load
    async function fetchRecommended() {
      setIsSearching(true);
      try {
        const recommended = await getRecommendedNumbers();
        setResults(recommended);
      } catch (err) {
        toast.error("Failed to fetch recommended numbers.");
      } finally {
        setIsSearching(false);
      }
    }
    fetchRecommended();
  }, []);

  const handleSearch = async () => {
    setIsSearching(true);
    setSelectedNumbers(new Set()); // Reset selections on new search
    try {
      const searchResults = await searchNumbers({
        country,
        type: numberType,
        contains: searchPhrase,
        matchType: matchCriteria,
        capabilities: {
          voice: capVoice,
          sms: capSms,
          mms: capMms,
        }
      });
      setResults(searchResults);
      if (searchResults.length === 0) {
        toast.info("No numbers found matching your criteria.");
      }
    } catch (err) {
      toast.error("Failed to perform search.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearFilters = () => {
    setCountry("us");
    setNumberType("any");
    setSearchPhrase("");
    setMatchCriteria("anywhere");
    setCapVoice(true);
    setCapSms(true);
    setCapMms(false);
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

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const response = await checkoutNumbers(Array.from(selectedNumbers));
      if (response.success) {
        toast.success(response.message);
        setIsCheckoutModalOpen(false);
        setSelectedNumbers(new Set());
        // Optionally refresh inventory
        handleSearch();
      } else {
        toast.error(response.message);
      }
    } catch (err) {
      toast.error("Failed to checkout selected numbers.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const selectedTotalMonthly = Array.from(selectedNumbers).reduce((acc, id) => {
    const num = results.find(r => r.id === id);
    return acc + (num?.monthlyPrice || 0);
  }, 0);

  const selectedTotalSetup = Array.from(selectedNumbers).reduce((acc, id) => {
    const num = results.find(r => r.id === id);
    return acc + (num?.setupFee || 0);
  }, 0);

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
          <Button variant="outline" className="gap-2" onClick={handleSearch} disabled={isSearching}>
            <RefreshCcw className={`h-4 w-4 ${isSearching ? 'animate-spin' : ''}`} />
            Refresh Inventory
          </Button>
          <Button 
            className="gap-2" 
            disabled={selectedNumbers.size === 0}
            onClick={() => setIsCheckoutModalOpen(true)}
          >
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
              <Select value={country} onValueChange={setCountry}>
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
              <Select value={numberType} onValueChange={setNumberType}>
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
                <Input 
                  type="text" 
                  placeholder="e.g. 415 or CODE" 
                  className="flex-1" 
                  value={searchPhrase}
                  onChange={(e) => setSearchPhrase(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Match Criteria</Label>
              <Select value={matchCriteria} onValueChange={setMatchCriteria}>
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
                <Checkbox id="cap-voice" checked={capVoice} onCheckedChange={(c) => setCapVoice(c as boolean)} />
                <label
                  htmlFor="cap-voice"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                >
                  <PhoneCall className="h-4 w-4 text-blue-500" />
                  Voice
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cap-sms" checked={capSms} onCheckedChange={(c) => setCapSms(c as boolean)} />
                <label
                  htmlFor="cap-sms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                >
                  <MessageSquare className="h-4 w-4 text-green-500" />
                  SMS
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cap-mms" checked={capMms} onCheckedChange={(c) => setCapMms(c as boolean)} />
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
          <Button variant="ghost" className="text-neutral-500" onClick={handleClearFilters}>
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
                    {isSearching ? "Searching..." : "No numbers found matching your criteria."}
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

      <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              You are about to purchase {selectedNumbers.size} number(s).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Monthly Recurring:</span>
              <span className="font-semibold">${selectedTotalMonthly.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-500 text-sm">
              <span>One-time Setup Fees:</span>
              <span>${selectedTotalSetup.toFixed(2)}</span>
            </div>
            <div className="border-t mt-4 pt-4 flex justify-between items-center">
              <span className="text-sm font-bold">Total Due Today:</span>
              <span className="font-bold text-lg">${(selectedTotalMonthly + selectedTotalSetup).toFixed(2)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckoutModalOpen(false)} disabled={isCheckingOut}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={isCheckingOut} className="gap-2">
              {isCheckingOut ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              {isCheckingOut ? "Processing..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
