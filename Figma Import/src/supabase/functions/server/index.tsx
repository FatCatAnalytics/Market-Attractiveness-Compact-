import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Add logger middleware
app.use("*", logger(console.log));

// Create Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-3ecd9a92/health", (c) => {
  return c.json({ status: "ok" });
});

// Get summary statistics for the dashboard cards
app.get("/make-server-3ecd9a92/summary", async (c) => {
  try {
    // Fetch all attractiveness data (excluding Deposits)
    const { data: attractivenessData, error: attractivenessError } = await supabase
      .from("Attractiveness")
      .select("*")
      .neq("Product", "Deposits");

    if (attractivenessError) {
      return c.json({ error: "Failed to fetch attractiveness data: " + attractivenessError.message }, 500);
    }

    const { data: opportunityData, error: opportunityError } = await supabase
      .from("Opportunity")
      .select("*")
      .neq("Product", "Deposits")
      .eq("Included_In_Ranking", true);

    if (opportunityError) {
      return c.json({ error: "Failed to fetch opportunity data: " + opportunityError.message }, 500);
    }

    // Get providers from Opportunity table (excluding Deposits to match dashboard filters)
    const { data: allOpportunityData, error: allOpportunityError } = await supabase
      .from("Opportunity")
      .select("Provider")
      .neq("Product", "Deposits");

    if (allOpportunityError) {
      return c.json({ error: "Failed to fetch all opportunity data: " + allOpportunityError.message }, 500);
    }

    // Calculate Card 1: MSA Overview
    const uniqueMSAs = new Set(attractivenessData.map((row: any) => row.MSA));
    const totalMSAs = uniqueMSAs.size;
    
    // Count distinct banks/providers from Credit and Cash Management products only
    const uniqueBanks = new Set(
      allOpportunityData
        .map((row: any) => {
          const provider = row.Provider;
          // Trim whitespace and normalize
          return provider && typeof provider === 'string' ? provider.trim() : provider;
        })
        .filter((val: any) => val !== null && val !== undefined && val !== "")
    );
    const totalBanks = uniqueBanks.size;

    // Calculate Card 2: Targeted Opportunities
    // Get MSAs with Highly Attractive category
    const highAttractivenessData = attractivenessData.filter(
      (row: any) => row.Attractiveness_Category === "Highly Attractive"
    );
    const highAttractiveMSAs = new Set(highAttractivenessData.map((row: any) => row.MSA));
    
    // Count opportunities by category distribution (distinct by MSA-Provider-Product)
    const uniqueOpportunities = new Set<string>();
    const opportunityDistribution: Record<string, number> = {};
    
    opportunityData.forEach((opp: any) => {
      // Create a unique key for each opportunity
      const uniqueKey = `${opp.MSA}|${opp.Provider || opp.Bank || opp.Institution}|${opp.Product}`;
      
      // Only count if we haven't seen this opportunity before
      if (!uniqueOpportunities.has(uniqueKey)) {
        uniqueOpportunities.add(uniqueKey);
        const category = opp.Opportunity_Category || "Unknown";
        opportunityDistribution[category] = (opportunityDistribution[category] || 0) + 1;
      }
    });
    
    // Count excellent opportunities in those high attractiveness MSAs (for backward compatibility)
    const uniqueExcellentInHigh = new Set<string>();
    opportunityData.forEach((opp: any) => {
      const uniqueKey = `${opp.MSA}|${opp.Provider || opp.Bank || opp.Institution}|${opp.Product}`;
      if (!uniqueExcellentInHigh.has(uniqueKey)) {
        const msaProducts = highAttractivenessData.filter((attr: any) => attr.MSA === opp.MSA);
        if (msaProducts.length > 0 && opp.Opportunity_Category === "Excellent") {
          uniqueExcellentInHigh.add(uniqueKey);
        }
      }
    });
    const excellentOpportunitiesInHighMSAs = uniqueExcellentInHigh.size;

    // Calculate Card 3: National Market Overview
    const totalMarketSize = attractivenessData.reduce((sum: number, row: any) => sum + (row["Market Size"] || 0), 0);
    const avgRiskScore = attractivenessData.reduce((sum: number, row: any) => sum + (row.Risk || 0), 0) / attractivenessData.length;
    const avgPricing = attractivenessData.reduce((sum: number, row: any) => sum + (row.Price || 0), 0) / attractivenessData.length;
    
    // Calculate average Lending Volume Annual Change
    const avgLendingVolumeChange = attractivenessData.reduce(
      (sum: number, row: any) => sum + (row["Lending Volume Annual Change"] || 0), 
      0
    ) / attractivenessData.length;
    
    // Calculate average Loan to Deposit Ratio
    const avgLoanToDepositChange = attractivenessData.reduce(
      (sum: number, row: any) => sum + (row["Loan to Deposit Ratio"] || 0), 
      0
    ) / attractivenessData.length;

    // Calculate Card 4: Risk & Pricing Analysis
    const rationalPricingCount = attractivenessData.filter((row: any) => row.Pricing_Rationality === "Rational").length;
    const overpricedCount = attractivenessData.filter((row: any) => row.Pricing_Rationality === "Overpriced (Opportunity)").length;
    const underpricedCount = attractivenessData.filter((row: any) => row.Pricing_Rationality === "Underpriced (Risk)").length;
    const irrationalPricingCount = overpricedCount + underpricedCount;
    
    const premiumMarkets = attractivenessData.filter((row: any) => row.Premium_Discount === "Premium").length;
    const atParMarkets = attractivenessData.filter((row: any) => row.Premium_Discount === "Par").length;
    const discountMarkets = attractivenessData.filter((row: any) => row.Premium_Discount === "Discount").length;

    return c.json({
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
    });
  } catch (error) {
    return c.json({ error: "Internal server error: " + error.message }, 500);
  }
});

// Get map data for MSAs
app.get("/make-server-3ecd9a92/map-data", async (c) => {
  try {
    const { data, error } = await supabase
      .from("Attractiveness")
      .select("*")
      .neq("Product", "Deposits");

    if (error) {
      return c.json({ error: "Failed to fetch map data: " + error.message }, 500);
    }

    return c.json(data);
  } catch (error) {
    return c.json({ error: "Internal server error: " + error.message }, 500);
  }
});

// Get MSA details and opportunities for hover
app.get("/make-server-3ecd9a92/msa/:msaName", async (c) => {
  try {
    const msaName = c.req.param("msaName");

    // Fetch attractiveness data for the MSA (excluding Deposits)
    const { data: attractivenessData, error: attractivenessError } = await supabase
      .from("Attractiveness")
      .select("*")
      .eq("MSA", msaName)
      .neq("Product", "Deposits");

    if (attractivenessError) {
      console.error("Error fetching MSA attractiveness data:", attractivenessError);
      return c.json({ error: "Failed to fetch MSA attractiveness data: " + attractivenessError.message }, 500);
    }

    // Fetch ALL opportunity data for the MSA (excluding Deposits, no Included_In_Ranking filter, no limit)
    // Frontend will filter for Competitor Opportunities tab, but show all for Market Share section
    const { data: opportunityData, error: opportunityError } = await supabase
      .from("Opportunity")
      .select("*")
      .eq("MSA", msaName)
      .neq("Product", "Deposits")
      .order("Provider_Opportunity_Rank", { ascending: true });

    if (opportunityError) {
      console.error("Error fetching MSA opportunity data:", opportunityError);
      return c.json({ error: "Failed to fetch MSA opportunity data: " + opportunityError.message }, 500);
    }

    return c.json({
      attractiveness: attractivenessData,
      opportunities: opportunityData,
    });
  } catch (error) {
    console.error("Error fetching MSA details:", error);
    return c.json({ error: "Internal server error: " + error.message }, 500);
  }
});

// Get RAW opportunities data without attractiveness join (for frontend calculation)
app.get("/make-server-3ecd9a92/opportunities-raw", async (c) => {
  try {
    const pageSize = 1000;
    let allOpportunities: any[] = [];
    let page = 0;
    let hasMore = true;

    // Paginate through all opportunities (excluding Deposits, only Included_In_Ranking = true)
    while (hasMore) {
      const { data: opportunityData, error: opportunityError } = await supabase
        .from("Opportunity")
        .select("*")
        .neq("Product", "Deposits")
        .eq("Included_In_Ranking", true)
        .order("Overall_Opportunity_Rank", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (opportunityError) {
        console.error("Error fetching opportunities page:", opportunityError);
        return c.json({ error: "Failed to fetch opportunities: " + opportunityError.message }, 500);
      }

      if (opportunityData && opportunityData.length > 0) {
        allOpportunities = allOpportunities.concat(opportunityData);
        
        // If we got less than pageSize, we've reached the end
        if (opportunityData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    return c.json(allOpportunities);
  } catch (error) {
    console.error("Error fetching raw opportunities:", error);
    return c.json({ error: "Internal server error: " + error.message }, 500);
  }
});

// Get all opportunities data for Target Opportunities page (with pagination) - LEGACY with DB attractiveness
app.get("/make-server-3ecd9a92/opportunities", async (c) => {
  try {
    const pageSize = 1000;
    let allOpportunities: any[] = [];
    let page = 0;
    let hasMore = true;

    // Paginate through all opportunities (excluding Deposits, only Included_In_Ranking = true)
    while (hasMore) {
      const { data: opportunityData, error: opportunityError } = await supabase
        .from("Opportunity")
        .select("*")
        .neq("Product", "Deposits")
        .eq("Included_In_Ranking", true)
        .order("Overall_Opportunity_Rank", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (opportunityError) {
        console.error("Error fetching opportunities page:", opportunityError);
        return c.json({ error: "Failed to fetch opportunities: " + opportunityError.message }, 500);
      }

      if (opportunityData && opportunityData.length > 0) {
        allOpportunities = allOpportunities.concat(opportunityData);
        
        // If we got less than pageSize, we've reached the end
        if (opportunityData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // Fetch attractiveness data to join with opportunities (excluding Deposits)
    const { data: attractivenessData, error: attractivenessError } = await supabase
      .from("Attractiveness")
      .select("MSA, Product, Attractiveness_Category")
      .neq("Product", "Deposits");

    if (attractivenessError) {
      console.error("Error fetching attractiveness data:", attractivenessError);
      return c.json({ error: "Failed to fetch attractiveness data: " + attractivenessError.message }, 500);
    }

    // Create a lookup map for attractiveness by MSA and Product
    const attractivenessMap = new Map<string, string>();
    attractivenessData?.forEach((item: any) => {
      const key = `${item.MSA}|${item.Product}`;
      attractivenessMap.set(key, item.Attractiveness_Category);
    });

    // Enrich opportunities with Attractiveness_Category
    const enrichedOpportunities = allOpportunities.map((opp) => {
      const key = `${opp.MSA}|${opp.Product}`;
      const attractivenessCategory = attractivenessMap.get(key);
      
      return {
        ...opp,
        Attractiveness_Category: attractivenessCategory || "Unknown"
      };
    });
    
    return c.json(enrichedOpportunities);
  } catch (error) {
    console.error("Error fetching opportunities:", error);
    return c.json({ error: "Internal server error: " + error.message }, 500);
  }
});

// Get ALL market data (including records with Included_In_Ranking = false) for market share analysis
app.get("/make-server-3ecd9a92/market-data", async (c) => {
  try {
    const pageSize = 1000;
    let allMarketData: any[] = [];
    let page = 0;
    let hasMore = true;

    // Paginate through ALL opportunities (excluding Deposits, NO filter on Included_In_Ranking)
    while (hasMore) {
      const { data: opportunityData, error: opportunityError } = await supabase
        .from("Opportunity")
        .select("*")
        .neq("Product", "Deposits")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (opportunityError) {
        console.error("Error fetching market data page:", opportunityError);
        return c.json({ error: "Failed to fetch market data: " + opportunityError.message }, 500);
      }

      if (opportunityData && opportunityData.length > 0) {
        allMarketData = allMarketData.concat(opportunityData);
        
        // If we got less than pageSize, we've reached the end
        if (opportunityData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // Fetch attractiveness data to join with market data (excluding Deposits)
    const { data: attractivenessData, error: attractivenessError } = await supabase
      .from("Attractiveness")
      .select("MSA, Product, Attractiveness_Category")
      .neq("Product", "Deposits");

    if (attractivenessError) {
      console.error("Error fetching attractiveness data for market:", attractivenessError);
      return c.json({ error: "Failed to fetch attractiveness data: " + attractivenessError.message }, 500);
    }

    // Create a lookup map for attractiveness by MSA and Product
    const attractivenessMap = new Map<string, string>();
    attractivenessData?.forEach((item: any) => {
      const key = `${item.MSA}|${item.Product}`;
      attractivenessMap.set(key, item.Attractiveness_Category);
    });

    // Enrich market data with Attractiveness_Category
    const enrichedMarketData = allMarketData.map((opp) => {
      const key = `${opp.MSA}|${opp.Product}`;
      const attractivenessCategory = attractivenessMap.get(key);
      
      return {
        ...opp,
        Attractiveness_Category: attractivenessCategory || "Unknown"
      };
    });
    
    return c.json(enrichedMarketData);
  } catch (error) {
    console.error("Error fetching market data:", error);
    return c.json({ error: "Internal server error: " + error.message }, 500);
  }
});

// Get bucket ranges for Market Size and Revenue per Company filters
app.get("/make-server-3ecd9a92/filter-buckets", async (c) => {
  try {
    // Fetch all Attractiveness data (columns with spaces need to be accessed via bracket notation)
    const { data: attractivenessData, error } = await supabase
      .from("Attractiveness")
      .select("*")
      .neq("Product", "Deposits");

    if (error) {
      console.error("Error fetching filter bucket data:", error);
      return c.json({ error: "Failed to fetch filter bucket data: " + error.message }, 500);
    }

    if (!attractivenessData || attractivenessData.length === 0) {
      return c.json({ error: "No data available for filter buckets" }, 404);
    }

    // Extract and sort values
    const marketSizeValues = attractivenessData
      .map((row: any) => row["Market Size"])
      .filter((val: any) => val !== null && val !== undefined && !isNaN(val))
      .sort((a: number, b: number) => a - b);

    const revenuePerCompanyValues = attractivenessData
      .map((row: any) => row["Revenue per Company"])
      .filter((val: any) => val !== null && val !== undefined && !isNaN(val))
      .sort((a: number, b: number) => a - b);

    // Calculate fixed Market Size buckets (predefined ranges)
    const calculateMarketSizeBuckets = (sortedValues: number[]) => {
      if (sortedValues.length === 0) return [];

      const bucketRanges = [
        { label: "< $250M", min: 0, max: 250000000 },
        { label: "$250M - $500M", min: 250000000, max: 500000000 },
        { label: "$500M - $750M", min: 500000000, max: 750000000 },
        { label: "$750M - $1B", min: 750000000, max: 1000000000 },
        { label: "> $1B", min: 1000000000, max: Infinity }
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

    // Calculate range-based buckets for Revenue per Company (5 equal ranges from min to max)
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
        
        // Count how many values fall in this range
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

    // Calculate overall min/max for custom bucket creation
    const marketSizeRange = {
      min: marketSizeValues.length > 0 ? marketSizeValues[0] : 0,
      max: marketSizeValues.length > 0 ? marketSizeValues[marketSizeValues.length - 1] : 0
    };

    const revenuePerCompanyRange = {
      min: revenuePerCompanyValues.length > 0 ? revenuePerCompanyValues[0] : 0,
      max: revenuePerCompanyValues.length > 0 ? revenuePerCompanyValues[revenuePerCompanyValues.length - 1] : 0
    };

    return c.json({
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
    });
  } catch (error) {
    console.error("Error calculating filter buckets:", error);
    return c.json({ error: "Internal server error: " + error.message }, 500);
  }
});

// Get deposit market share data for HHI calculations
app.get("/make-server-3ecd9a92/deposit-data", async (c) => {
  try {
    const pageSize = 1000;
    let allDepositData: any[] = [];
    let page = 0;
    let hasMore = true;

    // Paginate through ALL deposit opportunities (Product = "Deposits")
    while (hasMore) {
      const { data: depositData, error: depositError } = await supabase
        .from("Opportunity")
        .select("MSA, Provider, \"Market Share\"")
        .eq("Product", "Deposits")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (depositError) {
        console.error("Error fetching deposit data page:", depositError);
        return c.json({ error: "Failed to fetch deposit data: " + depositError.message }, 500);
      }

      if (depositData && depositData.length > 0) {
        allDepositData = allDepositData.concat(depositData);
        
        // If we got less than pageSize, we've reached the end
        if (depositData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    return c.json(allDepositData);
  } catch (error) {
    console.error("Error fetching deposit data:", error);
    return c.json({ error: "Internal server error: " + error.message }, 500);
  }
});

Deno.serve(app.fetch);