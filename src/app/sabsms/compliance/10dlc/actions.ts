"use server";

// Mocking direct API integration with The Campaign Registry (TCR)

export async function fetchTcrStatus() {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  return {
    brands: {
      trustScore: 95,
      activeCount: 12,
      eligibleUpgrades: 3,
    },
    campaigns: {
      activeCount: 3,
      pendingCount: 1,
      maxThroughput: 12000,
    }
  };
}

export async function registerBrand(formData: FormData) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  
  const legalName = formData.get("legalName");
  
  // Simulate a successful brand registration to TCR
  return {
    success: true,
    message: `Brand "${legalName}" has been submitted for vetting.`,
    brandId: `B-${Math.floor(Math.random() * 1000000)}`
  };
}

export async function registerCampaign(formData: FormData) {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  
  const useCase = formData.get("useCase");
  
  return {
    success: true,
    message: `Campaign for "${useCase}" registered successfully.`,
    campaignId: `C-${Math.floor(Math.random() * 1000000)}`
  };
}
