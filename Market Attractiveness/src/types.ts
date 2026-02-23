export interface GlobalFilters {
  marketSizeRange: [number, number];
  revenuePerCompanyRange: [number, number];
  selectedRegions: string[];
  selectedIndustries: string[];
}

export interface SummaryData {
  msaOverview: {
    totalMSAs: number;
    totalBanks: number;
  };
  targetedOpportunities: {
    highAttractiveMSAs: number;
    excellentOpportunities: number;
    opportunityDistribution: Record<string, number>;
  };
  nationalMarket: {
    totalMarketSize: number;
    avgRiskScore: number;
    avgPricing: number;
    avgLendingVolumeChange: number;
    avgLoanToDepositChange: number;
  };
  riskPricing: {
    premiumMarkets: number;
    atParMarkets: number;
    discountMarkets: number;
    rationalPricing: number;
    irrationalPricing: number;
    overpricedOpportunity: number;
    underpricedRisk: number;
  };
}

export interface MSAData {
  MSA: string;
  Product: string;
  LAT: number;
  LON: number;
  Attractiveness_Score: number;
  Attractiveness_Category: string;
  "Market Size": number;
  Risk: number;
  Price: number;
  Driving_Metric: string;
  Market_Size_Score: string;
  HHI_Score: string;
  Economic_Growth_Score: string;
  Loan_Growth_Score: string;
  Risk_Score: string;
  Risk_Migration_Score: string;
  Relative_Risk_Migration_Score: string;
  Premium_Discount_Score: string;
  Pricing_Rationality_Score: string;
  Revenue_per_Company_Score: string;
  International_CM_Score: string;
  Pricing_Rationality: string;
  Pricing_Rationality_Explanation: string;
}

export interface SelectedFranchise {
  Provider: string;
  MSA: string;
  Product: string;
  "Market Share": string | number;
  "Defend $": string | number;
  "Market Size": string | number;
  Opportunity_Category: string;
  Attractiveness_Category: string;
}

export interface OpportunityData {
  Provider: string;
  MSA: string;
  Product: string;
  "Market Share": string | number;
  "Defend $": string | number;
  "Market Size": string | number;
  LAT?: number;
  LON?: number;
  Opportunity_Category: string;
  Attractiveness_Category: string;
  Provider_Opportunity_Rank?: number;
  Overall_Opportunity_Rank?: number;
  Weighted_Average_Score?: number;
  Exclusion?: boolean;
  Included_In_Ranking?: boolean;
  Pricing_Rationality?: string;
  Pricing_Rationality_Explanation?: string;
}
