// CSV Data Service - Replaces Supabase database calls with local CSV files

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
  // Add Attractiveness_Category for enriched opportunities
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

    // Get headers from first line
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Parse data rows
    const startIndex = skipHeader ? 1 : 0;
    const data: T[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue; // Skip malformed rows

      const row: any = {};
      headers.forEach((header, index) => {
        let value = values[index]?.trim() || '';
        
        // Convert to appropriate types
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
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    values.push(current);
    return values;
  }

  // Load CSV files
  async loadData(): Promise<void> {
    // If already loading, return the existing promise
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // If already loaded, return immediately
    if (this.dataLoaded) {
      return Promise.resolve();
    }

    this.loadingPromise = this.performDataLoad();
    return this.loadingPromise;
  }

  private async performDataLoad(): Promise<void> {
    try {
      console.log('CSVDataService: Starting to load CSV files...');
      
      // Load both CSV files
      const [attractivenessResponse, opportunityResponse] = await Promise.all([
        fetch('/attractivenes.csv'),
        fetch('/opportunity.csv')
      ]);

      console.log('CSVDataService: Fetch responses:', {
        attractiveness: {
          ok: attractivenessResponse.ok,
          status: attractivenessResponse.status,
          statusText: attractivenessResponse.statusText,
          url: attractivenessResponse.url
        },
        opportunity: {
          ok: opportunityResponse.ok,
          status: opportunityResponse.status,
          statusText: opportunityResponse.statusText,
          url: opportunityResponse.url
        }
      });

      if (!attractivenessResponse.ok) {
        throw new Error(`Failed to load attractivenes.csv: ${attractivenessResponse.status} ${attractivenessResponse.statusText}. URL: ${attractivenessResponse.url}`);
      }
      if (!opportunityResponse.ok) {
        throw new Error(`Failed to load opportunity.csv: ${opportunityResponse.status} ${opportunityResponse.statusText}. URL: ${opportunityResponse.url}`);
      }

      const [attractivenessText, opportunityText] = await Promise.all([
        attractivenessResponse.text(),
        opportunityResponse.text()
      ]);

      console.log('CSVDataService: CSV files loaded, parsing...', {
        attractivenessLength: attractivenessText.length,
        opportunityLength: opportunityText.length
      });

      // Parse CSV data
      this.attractivenessData = this.parseCSV<AttractivenessRow>(attractivenessText);
      this.opportunityData = this.parseCSV<OpportunityRow>(opportunityText);

      console.log(`CSVDataService: Successfully loaded ${this.attractivenessData.length} attractiveness records and ${this.opportunityData.length} opportunity records`);

      this.dataLoaded = true;
    } catch (error) {
      console.error('CSVDataService: Error loading CSV data:', error);
      throw error;
    } finally {
      this.loadingPromise = null;
    }
  }

  // Get summary statistics (replaces /summary endpoint)
  async getSummaryData() {
    await this.loadData();

    // Filter out Deposits product
    const attractivenessDataFiltered = this.attractivenessData.filter(
      row => row.Product !== 'Deposits'
    );
    const opportunityDataFiltered = this.opportunityData.filter(
      row => row.Product !== 'Deposits' && row.Included_In_Ranking === true
    );
    const allOpportunityData = this.opportunityData.filter(
      row => row.Product !== 'Deposits'
    );

    // Calculate Card 1: MSA Overview
    const uniqueMSAs = new Set(attractivenessDataFiltered.map(row => row.MSA));
    const totalMSAs = uniqueMSAs.size;

    // Count distinct banks/providers
    const uniqueBanks = new Set(
      allOpportunityData
        .map(row => row.Provider?.trim())
        .filter(val => val !== null && val !== undefined && val !== '')
    );
    const totalBanks = uniqueBanks.size;

    // Calculate Card 2: Targeted Opportunities
    const highAttractivenessData = attractivenessDataFiltered.filter(
      row => row.Attractiveness_Category === 'Highly Attractive'
    );
    const highAttractiveMSAs = new Set(highAttractivenessData.map(row => row.MSA));

    // Count opportunities by category distribution
    const uniqueOpportunities = new Set<string>();
    const opportunityDistribution: Record<string, number> = {};

    opportunityDataFiltered.forEach(opp => {
      const uniqueKey = `${opp.MSA}|${opp.Provider}|${opp.Product}`;
      if (!uniqueOpportunities.has(uniqueKey)) {
        uniqueOpportunities.add(uniqueKey);
        const category = opp.Opportunity_Category || 'Unknown';
        opportunityDistribution[category] = (opportunityDistribution[category] || 0) + 1;
      }
    });

    // Count excellent opportunities in high attractiveness MSAs
    const uniqueExcellentInHigh = new Set<string>();
    opportunityDataFiltered.forEach(opp => {
      const uniqueKey = `${opp.MSA}|${opp.Provider}|${opp.Product}`;
      if (!uniqueExcellentInHigh.has(uniqueKey)) {
        const msaProducts = highAttractivenessData.filter(attr => attr.MSA === opp.MSA);
        if (msaProducts.length > 0 && opp.Opportunity_Category === 'Excellent') {
          uniqueExcellentInHigh.add(uniqueKey);
        }
      }
    });
    const excellentOpportunitiesInHighMSAs = uniqueExcellentInHigh.size;

    // Calculate Card 3: National Market Overview
    const totalMarketSize = attractivenessDataFiltered.reduce(
      (sum, row) => sum + (row["Market Size"] || 0), 0
    );
    const avgRiskScore = attractivenessDataFiltered.reduce(
      (sum, row) => sum + (row.Risk || 0), 0
    ) / attractivenessDataFiltered.length;
    const avgPricing = attractivenessDataFiltered.reduce(
      (sum, row) => sum + (row.Price || 0), 0
    ) / attractivenessDataFiltered.length;
    const avgLendingVolumeChange = attractivenessDataFiltered.reduce(
      (sum, row) => sum + (row["Lending Volume Annual Change"] || 0), 0
    ) / attractivenessDataFiltered.length;
    const avgLoanToDepositChange = attractivenessDataFiltered.reduce(
      (sum, row) => sum + (row["Loan to Deposit Ratio"] || 0), 0
    ) / attractivenessDataFiltered.length;

    // Calculate Card 4: Risk & Pricing Analysis
    const rationalPricingCount = attractivenessDataFiltered.filter(
      row => row.Pricing_Rationality === 'Rational'
    ).length;
    const overpricedCount = attractivenessDataFiltered.filter(
      row => row.Pricing_Rationality === 'Overpriced (Opportunity)'
    ).length;
    const underpricedCount = attractivenessDataFiltered.filter(
      row => row.Pricing_Rationality === 'Underpriced (Risk)'
    ).length;
    const irrationalPricingCount = overpricedCount + underpricedCount;

    const premiumMarkets = attractivenessDataFiltered.filter(
      row => row.Premium_Discount === 'Premium'
    ).length;
    const atParMarkets = attractivenessDataFiltered.filter(
      row => row.Premium_Discount === 'Par'
    ).length;
    const discountMarkets = attractivenessDataFiltered.filter(
      row => row.Premium_Discount === 'Discount'
    ).length;

    return {
      msaOverview: {
        totalMSAs,
        totalBanks,
      },
      targetedOpportunities: {
        highAttractiveMSAs: highAttractiveMSAs.size,
        excellentOpportunities: excellentOpportunitiesInHighMSAs,
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
        irrationalPricing: irrationalPricingCount,
        overpricedOpportunity: overpricedCount,
        underpricedRisk: underpricedCount,
      },
    };
  }

  // Get map data (replaces /map-data endpoint)
  async getMapData() {
    await this.loadData();
    return this.attractivenessData.filter(row => row.Product !== 'Deposits');
  }

  // Get MSA details (replaces /msa/:msaName endpoint)
  async getMSADetails(msaName: string) {
    await this.loadData();

    const attractiveness = this.attractivenessData.filter(
      row => row.MSA === msaName && row.Product !== 'Deposits'
    );

    // Get all opportunities for this MSA (no exclusion/inclusion filters)
    const allOppsForMSA = this.opportunityData.filter(row => row.MSA === msaName && row.Product !== 'Deposits');
    console.log(`CSVDataService: Found ${allOppsForMSA.length} total opportunities for MSA "${msaName}"`);
    
    // Check for Truist specifically
    const truistOpps = allOppsForMSA.filter(opp => opp.Provider && opp.Provider.toLowerCase().includes('truist'));
    console.log(`CSVDataService: Truist opportunities in ${msaName}:`, truistOpps.map(opp => ({
      Provider: opp.Provider,
      MarketShare: opp["Market Share"],
      Exclusion: opp.Exclusion,
      IncludedInRanking: opp.Included_In_Ranking,
      OpportunityCategory: opp.Opportunity_Category
    })));

    const opportunities = allOppsForMSA
      .sort((a, b) => (a.Provider_Opportunity_Rank || 999999) - (b.Provider_Opportunity_Rank || 999999));

    return {
      attractiveness,
      opportunities,
    };
  }

  // Get raw opportunities (replaces /opportunities-raw endpoint)
  async getOpportunitiesRaw() {
    await this.loadData();
    return this.opportunityData
      .filter(row => row.Product !== 'Deposits' && row.Included_In_Ranking === true)
      .sort((a, b) => (a.Overall_Opportunity_Rank || 999999) - (b.Overall_Opportunity_Rank || 999999));
  }

  // Get all opportunities without filtering by Included_In_Ranking
  async getAllOpportunitiesRaw() {
    await this.loadData();
    return this.opportunityData
      .filter(row => row.Product !== 'Deposits')
      .sort((a, b) => (a.Overall_Opportunity_Rank || 999999) - (b.Overall_Opportunity_Rank || 999999));
  }

  // Get opportunities with attractiveness (replaces /opportunities endpoint)
  async getOpportunities() {
    await this.loadData();

    const opportunities = this.opportunityData.filter(
      row => row.Product !== 'Deposits' && row.Included_In_Ranking === true
    );

    const attractivenessDataFiltered = this.attractivenessData.filter(
      row => row.Product !== 'Deposits'
    );

    // Create attractiveness lookup map
    const attractivenessMap = new Map<string, string>();
    attractivenessDataFiltered.forEach(item => {
      const key = `${item.MSA}|${item.Product}`;
      attractivenessMap.set(key, item.Attractiveness_Category);
    });

    // Enrich opportunities with Attractiveness_Category
    const enrichedOpportunities = opportunities.map(opp => {
      const key = `${opp.MSA}|${opp.Product}`;
      const attractivenessCategory = attractivenessMap.get(key);

      return {
        ...opp,
        Attractiveness_Category: attractivenessCategory || 'Unknown'
      };
    });

    return enrichedOpportunities.sort(
      (a, b) => (a.Overall_Opportunity_Rank || 999999) - (b.Overall_Opportunity_Rank || 999999)
    );
  }

  // Get market data (replaces /market-data endpoint)
  async getMarketData() {
    await this.loadData();

    const allMarketData = this.opportunityData.filter(
      row => row.Product !== 'Deposits'
    );

    const attractivenessDataFiltered = this.attractivenessData.filter(
      row => row.Product !== 'Deposits'
    );

    // Create attractiveness lookup map
    const attractivenessMap = new Map<string, string>();
    attractivenessDataFiltered.forEach(item => {
      const key = `${item.MSA}|${item.Product}`;
      attractivenessMap.set(key, item.Attractiveness_Category);
    });

    // Enrich market data with Attractiveness_Category
    const enrichedMarketData = allMarketData.map(opp => {
      const key = `${opp.MSA}|${opp.Product}`;
      const attractivenessCategory = attractivenessMap.get(key);

      return {
        ...opp,
        Attractiveness_Category: attractivenessCategory || 'Unknown'
      };
    });

    return enrichedMarketData;
  }

  // Get filter buckets (replaces /filter-buckets endpoint)
  async getFilterBuckets() {
    await this.loadData();

    const attractivenessDataFiltered = this.attractivenessData.filter(
      row => row.Product !== 'Deposits'
    );

    // Extract and sort values
    const marketSizeValues = attractivenessDataFiltered
      .map(row => row["Market Size"])
      .filter(val => val !== null && val !== undefined && !isNaN(val))
      .sort((a, b) => a - b);

    const revenuePerCompanyValues = attractivenessDataFiltered
      .map(row => row["Revenue per Company"])
      .filter(val => val !== null && val !== undefined && !isNaN(val))
      .sort((a, b) => a - b);

    // Calculate fixed Market Size buckets
    const calculateMarketSizeBuckets = (sortedValues: number[]) => {
      if (sortedValues.length === 0) return [];

      const bucketRanges = [
        { label: '< $250M', min: 0, max: 250000000 },
        { label: '$250M - $500M', min: 250000000, max: 500000000 },
        { label: '$500M - $750M', min: 500000000, max: 750000000 },
        { label: '$750M - $1B', min: 750000000, max: 1000000000 },
        { label: '> $1B', min: 1000000000, max: Infinity }
      ];

      return bucketRanges.map(range => {
        const count = sortedValues.filter(val =>
          val >= range.min && val < range.max
        ).length;

        return {
          label: range.label,
          min: range.min,
          max: range.max === Infinity ? sortedValues[sortedValues.length - 1] : range.max,
          count: count
        };
      });
    };

    // Calculate range-based buckets for Revenue per Company
    const calculateRangeBuckets = (sortedValues: number[]) => {
      const n = sortedValues.length;
      if (n === 0) return [];

      const minValue = sortedValues[0];
      const maxValue = sortedValues[n - 1];
      const rangeSize = (maxValue - minValue) / 5;

      const buckets = [];

      for (let i = 0; i < 5; i++) {
        const bucketMin = minValue + (i * rangeSize);
        const bucketMax = i === 4 ? maxValue : minValue + ((i + 1) * rangeSize);

        const count = sortedValues.filter(val =>
          val >= bucketMin && (i === 4 ? val <= bucketMax : val < bucketMax)
        ).length;

        buckets.push({
          label: `Bucket ${i + 1}`,
          min: bucketMin,
          max: bucketMax,
          count: count
        });
      }

      return buckets;
    };

    const marketSizeBuckets = calculateMarketSizeBuckets(marketSizeValues);
    const revenuePerCompanyBuckets = calculateRangeBuckets(revenuePerCompanyValues);

    const marketSizeRange = {
      min: marketSizeValues.length > 0 ? marketSizeValues[0] : 0,
      max: marketSizeValues.length > 0 ? marketSizeValues[marketSizeValues.length - 1] : 0
    };

    const revenuePerCompanyRange = {
      min: revenuePerCompanyValues.length > 0 ? revenuePerCompanyValues[0] : 0,
      max: revenuePerCompanyValues.length > 0 ? revenuePerCompanyValues[revenuePerCompanyValues.length - 1] : 0
    };

    return {
      marketSize: {
        buckets: marketSizeBuckets,
        range: marketSizeRange,
        totalCount: marketSizeValues.length
      },
      revenuePerCompany: {
        buckets: revenuePerCompanyBuckets,
        range: revenuePerCompanyRange,
        totalCount: revenuePerCompanyValues.length
      }
    };
  }

  // Get deposit data (replaces /deposit-data endpoint)
  async getDepositData() {
    await this.loadData();
    return this.opportunityData
      .filter(row => row.Product === 'Deposits')
      .map(row => ({
        MSA: row.MSA,
        Provider: row.Provider,
        "Market Share": row["Market Share"]
      }));
  }
}

// Export singleton instance
export const csvDataService = new CSVDataService();
