// CSV Data Service - Replaces Supabase database calls with local CSV files

import { SummaryData, MSAData, OpportunityData } from "../types";

interface AttractivenessRow {
  MSA: string;
  Product: string;
  LAT: number;
  LON: number;
  "Market Size": number;
  "Number of Companies": number;
  Risk: number;
  Price: number;
  Premium_Discount: string;
  Pricing_Rationality: string;
  Pricing_Rationality_Explanation: string;
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
  Attractiveness_Score: number;
  Attractiveness_Category: string;
  Driving_Metric: string;
  "Driving_Metric_Score": string;
  "Herfindahl-Hirschman Index (HHI)": number;
  Economic_Growth: number;
  "Lending Volume Annual Change": number;
  "Proportion of International Cash Management Revenue": number;
  "Loan to Deposit Ratio": number;
  "Revenue per Company": number;
  Net_Risk_Migration: number;
  National_Net_Risk_Migration: number;
  Relative_Risk_Migration: number;
  Risk_Migration_Stability: number;
  National_Risk_Migration_Stability: number;
  Relative_Risk_Migration_Stability: number;
  Risk_Migration_Composite: number;
  Relative_Risk_Migration_Composite: number;
  "Risk Migration": string;
}

interface OpportunityRow {
  MSA: string;
  LAT: number;
  LON: number;
  Provider: string;
  "Market Size": number;
  "Number of Companies": number;
  "Market Share": number;
  "Defend $": number;
  Product: string;
  Exclusion: boolean;
  Included_In_Ranking: boolean;
  Provider_Ratio?: number;
  Benchmark?: number;
  Competitor_Ratio?: number;
  Provider_Opportunity_Rank?: number;
  Overall_Opportunity_Rank?: number;
  Opportunity_Score?: number;
  Opportunity_Category?: string;
  "Firm ID"?: number;
  Total_Weight?: number;
  Number_of_Occurrences?: number;
  Weighted_Average_Score?: number;
  Attractiveness_Category?: string;
}

class CSVDataService {
  private attractivenessData: AttractivenessRow[] = [];
  private opportunityData: OpportunityRow[] = [];
  private dataLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  // Parse CSV string to array of objects
  private parseCSV<T>(csvText: string, skipHeader = true): T[] {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const startIndex = skipHeader ? 1 : 0;
    const data: T[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        let value = values[index]?.trim() || '';
        
        if (value === 'TRUE') {
          row[header] = true;
        } else if (value === 'FALSE') {
          row[header] = false;
        } else if (value === '' || value === 'null' || value === 'undefined') {
          row[header] = null;
        } else if (!isNaN(Number(value)) && value !== '') {
          row[header] = Number(value);
        } else {
          row[header] = value;
        }
      });
      data.push(row as T);
    }

    return data;
  }

  // Parse a single CSV line, handling quoted values
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current);
    return values;
  }

  // Load CSV files
  async loadData(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (this.dataLoaded) {
      return Promise.resolve();
    }

    this.loadingPromise = this.performDataLoad();
    return this.loadingPromise;
  }

  private async performDataLoad(): Promise<void> {
    try {
      console.log('CSVDataService: Starting to load CSV files...');
      
      const [attractivenessResponse, opportunityResponse] = await Promise.all([
        fetch('/attractivenes.csv'),
        fetch('/opportunity.csv')
      ]);

      if (!attractivenessResponse.ok) {
        throw new Error(`Failed to load attractivenes.csv: ${attractivenessResponse.status}`);
      }
      if (!opportunityResponse.ok) {
        throw new Error(`Failed to load opportunity.csv: ${opportunityResponse.status}`);
      }

      const [attractivenessText, opportunityText] = await Promise.all([
        attractivenessResponse.text(),
        opportunityResponse.text()
      ]);

      this.attractivenessData = this.parseCSV<AttractivenessRow>(attractivenessText);
      this.opportunityData = this.parseCSV<OpportunityRow>(opportunityText);

      console.log(`CSVDataService: Loaded ${this.attractivenessData.length} attractiveness records and ${this.opportunityData.length} opportunity records`);

      this.dataLoaded = true;
    } catch (error) {
      console.error('CSVDataService: Error loading CSV data:', error);
      throw error;
    } finally {
      this.loadingPromise = null;
    }
  }

  // Get summary statistics
  async getSummaryData(): Promise<SummaryData> {
    await this.loadData();

    // Filter out Deposits product (only show Credit_Cash_Management)
    const attractivenessFiltered = this.attractivenessData.filter(
      row => row.Product !== 'Deposits'
    );
    const opportunityFiltered = this.opportunityData.filter(
      row => row.Product !== 'Deposits' && row.Included_In_Ranking === true
    );
    const allOpportunityData = this.opportunityData.filter(
      row => row.Product !== 'Deposits'
    );

    // Card 1: MSA Overview
    const uniqueMSAs = new Set(attractivenessFiltered.map(row => row.MSA));
    const totalMSAs = uniqueMSAs.size;

    const uniqueBanks = new Set(
      allOpportunityData
        .map(row => row.Provider?.trim())
        .filter(val => val !== null && val !== undefined && val !== '')
    );
    const totalBanks = uniqueBanks.size;

    // Card 2: Targeted Opportunities
    const highAttractivenessData = attractivenessFiltered.filter(
      row => row.Attractiveness_Category === 'Highly Attractive'
    );
    const highAttractiveMSAs = new Set(highAttractivenessData.map(row => row.MSA));

    const uniqueOpportunities = new Set<string>();
    const opportunityDistribution: Record<string, number> = {};

    opportunityFiltered.forEach(opp => {
      const uniqueKey = `${opp.MSA}|${opp.Provider}|${opp.Product}`;
      if (!uniqueOpportunities.has(uniqueKey)) {
        uniqueOpportunities.add(uniqueKey);
        const category = opp.Opportunity_Category || 'Unknown';
        opportunityDistribution[category] = (opportunityDistribution[category] || 0) + 1;
      }
    });

    const uniqueExcellentInHigh = new Set<string>();
    opportunityFiltered.forEach(opp => {
      const uniqueKey = `${opp.MSA}|${opp.Provider}|${opp.Product}`;
      if (!uniqueExcellentInHigh.has(uniqueKey)) {
        const msaProducts = highAttractivenessData.filter(attr => attr.MSA === opp.MSA);
        if (msaProducts.length > 0 && opp.Opportunity_Category === 'Excellent') {
          uniqueExcellentInHigh.add(uniqueKey);
        }
      }
    });

    // Card 3: National Market Overview
    const totalMarketSize = attractivenessFiltered.reduce(
      (sum, row) => sum + (row["Market Size"] || 0), 0
    );
    const avgRiskScore = attractivenessFiltered.reduce(
      (sum, row) => sum + (row.Risk || 0), 0
    ) / attractivenessFiltered.length;
    const avgPricing = attractivenessFiltered.reduce(
      (sum, row) => sum + (row.Price || 0), 0
    ) / attractivenessFiltered.length;
    const avgLendingVolumeChange = attractivenessFiltered.reduce(
      (sum, row) => sum + (row["Lending Volume Annual Change"] || 0), 0
    ) / attractivenessFiltered.length;
    const avgLoanToDepositChange = attractivenessFiltered.reduce(
      (sum, row) => sum + (row["Loan to Deposit Ratio"] || 0), 0
    ) / attractivenessFiltered.length;

    // Card 4: Risk & Pricing Analysis
    const rationalPricingCount = attractivenessFiltered.filter(
      row => row.Pricing_Rationality === 'Rational'
    ).length;
    const overpricedCount = attractivenessFiltered.filter(
      row => row.Pricing_Rationality === 'Overpriced (Opportunity)'
    ).length;
    const underpricedCount = attractivenessFiltered.filter(
      row => row.Pricing_Rationality === 'Underpriced (Risk)'
    ).length;

    const premiumMarkets = attractivenessFiltered.filter(
      row => row.Premium_Discount === 'Premium'
    ).length;
    const atParMarkets = attractivenessFiltered.filter(
      row => row.Premium_Discount === 'Par'
    ).length;
    const discountMarkets = attractivenessFiltered.filter(
      row => row.Premium_Discount === 'Discount'
    ).length;

    return {
      msaOverview: {
        totalMSAs,
        totalBanks,
      },
      targetedOpportunities: {
        highAttractiveMSAs: highAttractiveMSAs.size,
        excellentOpportunities: uniqueExcellentInHigh.size,
        opportunityDistribution,
      },
      nationalMarket: {
        totalMarketSize,
        avgRiskScore,
        avgPricing,
        avgLendingVolumeChange,
        avgLoanToDepositChange,
      },
      riskPricing: {
        premiumMarkets,
        atParMarkets,
        discountMarkets,
        rationalPricing: rationalPricingCount,
        irrationalPricing: overpricedCount + underpricedCount,
        overpricedOpportunity: overpricedCount,
        underpricedRisk: underpricedCount,
      },
    };
  }

  // Get map data (filter out Deposits)
  async getMapData(): Promise<MSAData[]> {
    await this.loadData();
    return this.attractivenessData
      .filter(row => row.Product !== 'Deposits')
      .map(row => ({
        MSA: row.MSA,
        Product: row.Product,
        LAT: row.LAT,
        LON: row.LON,
        Attractiveness_Score: row.Attractiveness_Score,
        Attractiveness_Category: row.Attractiveness_Category,
        "Market Size": row["Market Size"],
        Risk: row.Risk,
        Price: row.Price,
        Driving_Metric: row.Driving_Metric,
        Market_Size_Score: row.Market_Size_Score,
        HHI_Score: row.HHI_Score,
        Economic_Growth_Score: row.Economic_Growth_Score,
        Loan_Growth_Score: row.Loan_Growth_Score,
        Risk_Score: row.Risk_Score,
        Risk_Migration_Score: row.Risk_Migration_Score,
        Relative_Risk_Migration_Score: row.Relative_Risk_Migration_Score,
        Premium_Discount_Score: row.Premium_Discount_Score,
        Pricing_Rationality_Score: row.Pricing_Rationality_Score,
        Revenue_per_Company_Score: row.Revenue_per_Company_Score,
        International_CM_Score: row.International_CM_Score,
        Pricing_Rationality: row.Pricing_Rationality,
        Pricing_Rationality_Explanation: row.Pricing_Rationality_Explanation,
      }));
  }

  // Get MSA details
  async getMSADetails(msaName: string) {
    await this.loadData();

    const attractiveness = this.attractivenessData.filter(
      row => row.MSA === msaName && row.Product !== 'Deposits'
    );

    const opportunities = this.opportunityData
      .filter(row => row.MSA === msaName && row.Product !== 'Deposits')
      .sort((a, b) => (a.Provider_Opportunity_Rank || 999999) - (b.Provider_Opportunity_Rank || 999999));

    return {
      attractiveness,
      opportunities,
    };
  }

  // Get raw opportunities (only Included_In_Ranking)
  async getOpportunitiesRaw(): Promise<OpportunityData[]> {
    await this.loadData();
    return this.opportunityData
      .filter(row => row.Product !== 'Deposits' && row.Included_In_Ranking === true)
      .sort((a, b) => (a.Overall_Opportunity_Rank || 999999) - (b.Overall_Opportunity_Rank || 999999))
      .map(this.mapOpportunityRow);
  }

  // Get all opportunities (including excluded)
  async getAllOpportunitiesRaw(): Promise<OpportunityData[]> {
    await this.loadData();
    return this.opportunityData
      .filter(row => row.Product !== 'Deposits')
      .sort((a, b) => (a.Overall_Opportunity_Rank || 999999) - (b.Overall_Opportunity_Rank || 999999))
      .map(this.mapOpportunityRow);
  }

  // Get opportunities with attractiveness category
  async getOpportunities(): Promise<OpportunityData[]> {
    await this.loadData();

    const opportunities = this.opportunityData.filter(
      row => row.Product !== 'Deposits' && row.Included_In_Ranking === true
    );

    const attractivenessMap = new Map<string, string>();
    this.attractivenessData
      .filter(row => row.Product !== 'Deposits')
      .forEach(item => {
        const key = `${item.MSA}|${item.Product}`;
        attractivenessMap.set(key, item.Attractiveness_Category);
      });

    return opportunities
      .map(opp => {
        const key = `${opp.MSA}|${opp.Product}`;
        return {
          ...this.mapOpportunityRow(opp),
          Attractiveness_Category: attractivenessMap.get(key) || 'Unknown',
        };
      })
      .sort((a, b) => (a.Overall_Opportunity_Rank || 999999) - (b.Overall_Opportunity_Rank || 999999));
  }

  // Get market data (all opportunities with attractiveness)
  async getMarketData(): Promise<OpportunityData[]> {
    await this.loadData();

    const allMarketData = this.opportunityData.filter(
      row => row.Product !== 'Deposits'
    );

    const attractivenessMap = new Map<string, string>();
    this.attractivenessData
      .filter(row => row.Product !== 'Deposits')
      .forEach(item => {
        const key = `${item.MSA}|${item.Product}`;
        attractivenessMap.set(key, item.Attractiveness_Category);
      });

    return allMarketData.map(opp => {
      const key = `${opp.MSA}|${opp.Product}`;
      return {
        ...this.mapOpportunityRow(opp),
        Attractiveness_Category: attractivenessMap.get(key) || 'Unknown',
      };
    });
  }

  // Get filter buckets
  async getFilterBuckets() {
    await this.loadData();

    const attractivenessFiltered = this.attractivenessData.filter(
      row => row.Product !== 'Deposits'
    );

    const marketSizeValues = attractivenessFiltered
      .map(row => row["Market Size"])
      .filter(val => val !== null && val !== undefined && !isNaN(val))
      .sort((a, b) => a - b);

    const revenuePerCompanyValues = attractivenessFiltered
      .map(row => row["Revenue per Company"])
      .filter(val => val !== null && val !== undefined && !isNaN(val))
      .sort((a, b) => a - b);

    return {
      marketSize: {
        range: {
          min: marketSizeValues.length > 0 ? marketSizeValues[0] : 0,
          max: marketSizeValues.length > 0 ? marketSizeValues[marketSizeValues.length - 1] : 0,
        },
        totalCount: marketSizeValues.length,
      },
      revenuePerCompany: {
        range: {
          min: revenuePerCompanyValues.length > 0 ? revenuePerCompanyValues[0] : 0,
          max: revenuePerCompanyValues.length > 0 ? revenuePerCompanyValues[revenuePerCompanyValues.length - 1] : 0,
        },
        totalCount: revenuePerCompanyValues.length,
      },
    };
  }

  // Get deposit data (Deposits product only)
  async getDepositData() {
    await this.loadData();
    return this.opportunityData
      .filter(row => row.Product === 'Deposits')
      .map(row => ({
        MSA: row.MSA,
        Provider: row.Provider,
        "Market Share": row["Market Share"],
      }));
  }

  // Helper to map opportunity row to OpportunityData type
  private mapOpportunityRow(row: OpportunityRow): OpportunityData {
    return {
      Provider: row.Provider,
      MSA: row.MSA,
      Product: row.Product,
      "Market Share": row["Market Share"],
      "Defend $": row["Defend $"],
      "Market Size": row["Market Size"],
      LAT: row.LAT,
      LON: row.LON,
      Opportunity_Category: row.Opportunity_Category || '',
      Attractiveness_Category: row.Attractiveness_Category || '',
      Provider_Opportunity_Rank: row.Provider_Opportunity_Rank,
      Overall_Opportunity_Rank: row.Overall_Opportunity_Rank,
      Weighted_Average_Score: row.Weighted_Average_Score,
      Exclusion: row.Exclusion,
      Included_In_Ranking: row.Included_In_Ranking,
    };
  }
}

// Export singleton instance
export const csvDataService = new CSVDataService();
