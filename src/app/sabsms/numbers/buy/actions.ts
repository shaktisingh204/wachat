"use server";

import twilio from "twilio";

export type PhoneNumber = {
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
};

// Dummy data for fallback/mocking
const MOCK_INVENTORY: PhoneNumber[] = [
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
  {
    id: "num_7",
    number: "+13105551234",
    friendlyName: "(310) 555-1234",
    country: "US",
    region: "California",
    type: "Local",
    capabilities: { voice: true, sms: true, mms: true, fax: false },
    monthlyPrice: 1.15,
    setupFee: 0,
    currency: "USD",
  }
];

export async function searchNumbers(params: {
  country: string;
  type: string;
  contains?: string;
  matchType?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}): Promise<PhoneNumber[]> {
  try {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    
    // Wire up to Twilio if credentials exist
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      
      const containsStr = params.contains ? 
        (params.matchType === 'start' ? `${params.contains}*` : 
         params.matchType === 'end' ? `*${params.contains}` : 
         `*${params.contains}*`) 
        : undefined;

      let rawResults = [];

      if (params.type === "local" || params.type === "any") {
        const localNums = await client.availablePhoneNumbers(params.country.toUpperCase())
          .local.list({
            contains: containsStr,
            smsEnabled: params.capabilities.sms ? true : undefined,
            mmsEnabled: params.capabilities.mms ? true : undefined,
            voiceEnabled: params.capabilities.voice ? true : undefined,
            limit: 20
          }).catch(() => []);
        rawResults.push(...localNums.map(n => ({ ...n, type: "Local" })));
      }
      
      if (params.type === "mobile" || params.type === "any") {
        const mobileNums = await client.availablePhoneNumbers(params.country.toUpperCase())
          .mobile.list({
            contains: containsStr,
            smsEnabled: params.capabilities.sms ? true : undefined,
            mmsEnabled: params.capabilities.mms ? true : undefined,
            voiceEnabled: params.capabilities.voice ? true : undefined,
            limit: 20
          }).catch(() => []);
        rawResults.push(...mobileNums.map(n => ({ ...n, type: "Mobile" })));
      }

      if (params.type === "toll-free" || params.type === "any") {
        const tfNums = await client.availablePhoneNumbers(params.country.toUpperCase())
          .tollFree.list({
            contains: containsStr,
            smsEnabled: params.capabilities.sms ? true : undefined,
            voiceEnabled: params.capabilities.voice ? true : undefined,
            limit: 20
          }).catch(() => []);
        rawResults.push(...tfNums.map(n => ({ ...n, type: "Toll-Free" })));
      }

      if (rawResults.length > 0) {
        return rawResults.map((num, i) => ({
          id: `tw_${i}_${num.phoneNumber}`,
          number: num.phoneNumber,
          friendlyName: num.friendlyName,
          country: params.country.toUpperCase(),
          region: num.region || "Unknown",
          type: num.type as "Local" | "Mobile" | "Toll-Free",
          capabilities: {
            voice: num.capabilities.voice,
            sms: num.capabilities.sms,
            mms: num.capabilities.mms,
            fax: num.capabilities.fax
          },
          monthlyPrice: num.type === 'Toll-Free' ? 2.15 : 1.15,
          setupFee: 0,
          currency: "USD",
        }));
      }
    }
  } catch (err) {
    console.error("Twilio search failed, falling back to mock", err);
  }

  // Fallback to mock logic
  // Simulate network delay
  await new Promise(r => setTimeout(r, 800));
  
  return MOCK_INVENTORY.filter(num => {
    if (num.country.toLowerCase() !== params.country.toLowerCase()) return false;
    if (params.type !== "any" && num.type.toLowerCase() !== params.type.toLowerCase()) return false;
    
    if (params.capabilities.voice && !num.capabilities.voice) return false;
    if (params.capabilities.sms && !num.capabilities.sms) return false;
    if (params.capabilities.mms && !num.capabilities.mms) return false;

    if (params.contains) {
      const sanitizedNum = num.number.replace(/\D/g, '');
      const searchStr = params.contains.replace(/\D/g, '');
      if (params.matchType === 'start') {
        if (!sanitizedNum.startsWith(searchStr) && !num.friendlyName.includes(params.contains)) return false;
      } else if (params.matchType === 'end') {
        if (!sanitizedNum.endsWith(searchStr) && !num.friendlyName.includes(params.contains)) return false;
      } else {
        if (!sanitizedNum.includes(searchStr) && !num.friendlyName.includes(params.contains)) return false;
      }
    }

    return true;
  });
}

export async function getRecommendedNumbers(): Promise<PhoneNumber[]> {
  // Mock finding highest traffic regions for user (e.g., California)
  // And return numbers from that region
  await new Promise(r => setTimeout(r, 600));

  return MOCK_INVENTORY.filter(n => n.region === "California");
}

export async function checkoutNumbers(numberIds: string[]): Promise<{ success: boolean; message: string; provisioned: string[] }> {
  // Mock provisioning API
  await new Promise(r => setTimeout(r, 1500));
  
  if (numberIds.length === 0) {
    return { success: false, message: "No numbers selected", provisioned: [] };
  }

  return {
    success: true,
    message: `Successfully provisioned ${numberIds.length} number(s)`,
    provisioned: numberIds
  };
}
