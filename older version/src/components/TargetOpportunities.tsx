import { useState, useEffect, useMemo } from "react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from "recharts";
import { Search, Target, TrendingUp, Building2, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "./ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "./ui/utils";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { AcquisitionAnalysis } from "./AcquisitionAnalysis";
import { calculateDefensiveValue, categorizeOpportunitiesByPercentile, BucketAssignment } from "../utils/scoreCalculation";
import { GlobalFilters } from "../types";
import { applyGlobalFilters } from "../utils/applyGlobalFilters";
import { fetchFilterBuckets, fetchOpportunitiesRaw, fetchMarketData, fetchDepositData } from "../utils/csvDataHooks";

interface OpportunityData {
  Provider: string;
  MSA: string;
  Product: string;
  "Market Share": string | number;
  "Defend $": string | number;
  "Market Size": string | number;
  Opportunity_Category: string;
  Attractiveness_Category: string;
  Provider_Opportunity_Rank: number;
  Overall_Opportunity_Rank: number;
  Exclusion?: boolean;
  Weighted_Average_Score?: number;
}

interface AttractivenessData {
  MSA: string;
  Product: string;
  Attractiveness_Category: string;
  Attractiveness_Score: number;
  "Market Size"?: number;
  "Revenue per Company"?: number;
  Latitude?: number;
  Longitude?: number;
  [key: string]: any; // Allow other score fields
}

interface DepositData {
  MSA: string;
  Provider: string;
  "Market Share": string | number;
}

interface TargetOpportunitiesProps {
  attractivenessData: AttractivenessData[];
  onAnalyzeSelected: (franchises: OpportunityData[], providers: string[], market: OpportunityData[], depositData: DepositData[]) => void;
  globalFilters: GlobalFilters;
  bucketAssignments: BucketAssignment[];
  preselectedProviders?: Set<string>;
}

const COLORS = {
  Excellent: "#22c55e",
  Good: "#3b82f6",
  Fair: "#eab308",
  Poor: "#f97316",
};

const ATTRACTIVENESS_COLORS = {
  "Highly Attractive": "#22c55e",
  "Attractive": "#eab308",
  "Neutral": "#f97316",
  "Challenging": "#ef4444",
};

export function TargetOpportunities({ attractivenessData, onAnalyzeSelected, globalFilters, bucketAssignments, preselectedProviders }: TargetOpportunitiesProps) {
  const [data, setData] = useState<OpportunityData[]>([]);
  const [marketData, setMarketData] = useState<OpportunityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(preselectedProviders || new Set());
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAttractiveness, setSelectedAttractiveness] = useState("all");
  const [selectedMSA, setSelectedMSA] = useState("all");
  const [providerComboboxOpen, setProviderComboboxOpen] = useState(false);
  const [msaComboboxOpen, setMsaComboboxOpen] = useState(false);
  const [tableSelectedProviders, setTableSelectedProviders] = useState<Set<string>>(new Set());
  const [filterBuckets, setFilterBuckets] = useState<{
    marketSize?: { range: { min: number; max: number } };
    revenuePerCompany?: { range: { min: number; max: number } };
  }>({});
  
  // Modal state for Proforma Acquisition Analysis
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [analysisData, setAnalysisData] = useState<{
    franchises: OpportunityData[];
    providers: string[];
    market: OpportunityData[];
    deposits: DepositData[];
  } | null>(null);

  // Fetch filter buckets on mount
  useEffect(() => {
    const fetchBuckets = async () => {
      try {
        const data = await fetchFilterBuckets();
        setFilterBuckets({
          marketSize: data.marketSize,
          revenuePerCompany: data.revenuePerCompany,
        });
      } catch (error) {
        console.error("Error fetching filter buckets:", error);
      }
    };

    fetchBuckets();
  }, []);

  // Update selected providers when preselected providers change
  useEffect(() => {
    if (preselectedProviders && preselectedProviders.size > 0) {
      console.log('TargetOpportunities: Received preselected providers:', Array.from(preselectedProviders));
      setSelectedProviders(new Set(preselectedProviders));
    }
  }, [preselectedProviders]);

  useEffect(() => {
    fetchOpportunities();
  }, [attractivenessData]);

  const fetchOpportunities = async () => {
    setIsLoading(true);
    setError(null);
    const overallStart = performance.now();
    
    try {
      // Fetch both datasets in parallel for faster loading
      const fetchStart = performance.now();
      const [opportunityData, marketDataResponse] = await Promise.all([
        fetchOpportunitiesRaw(),
        fetchMarketData()
      ]);
      
      // Create attractiveness lookup map from calculated data
      const attractivenessMap = new Map<string, { category: string; score: number }>();
      for (let i = 0; i < attractivenessData.length; i++) {
        const item = attractivenessData[i];
        attractivenessMap.set(`${item.MSA}|${item.Product}`, {
          category: item.Attractiveness_Category,
          score: item.Attractiveness_Score,
        });
      }
      
      // Calculate Defensive Value Score for all opportunities (batch process)
      const opportunitiesWithScores = new Array(opportunityData.length);
      for (let i = 0; i < opportunityData.length; i++) {
        const opp = opportunityData[i];
        const attractiveness = attractivenessMap.get(`${opp.MSA}|${opp.Product}`);
        
        opportunitiesWithScores[i] = {
          ...opp,
          Attractiveness_Category: attractiveness?.category || "Unknown",
          Attractiveness_Score: attractiveness?.score || 0,
          Defensive_Value: calculateDefensiveValue(
            parseFloat(String(opp["Market Share"] || 0)),
            parseFloat(String(opp["Market Size"] || 0)),
            parseFloat(String(opp["Defend $"] || 0))
          ),
        };
      }
      
      // Categorize opportunities by percentile
      const enrichedOpportunities = categorizeOpportunitiesByPercentile(opportunitiesWithScores);
      
      setData(enrichedOpportunities);
      setMarketData(marketDataResponse);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique values for filters
  const providers = useMemo(() => {
    const providerSet = new Set(data.map(d => d.Provider));
    return Array.from(providerSet).sort();
  }, [data]);

  // Get all unique providers for acquirer selection (from all market data, not just ranked opportunities)
  const allProviders = useMemo(() => {
    const providerSet = new Set(marketData.map(d => d.Provider));
    return Array.from(providerSet).sort();
  }, [marketData]);

  const msas = useMemo(() => {
    const msaSet = new Set(data.map(d => d.MSA));
    return Array.from(msaSet).sort();
  }, [data]);

  const attractivenessCategories = useMemo(() => {
    const catSet = new Set(data.map(d => d.Attractiveness_Category).filter(c => c && c !== "Unknown"));
    return Array.from(catSet).sort();
  }, [data]);

  // Apply global filters first (from What-If Analysis page)
  const globalFilteredMSAs = useMemo(() => {
    // Use attractivenessData which has the necessary fields for global filtering
    const filtered = applyGlobalFilters(attractivenessData as any[], globalFilters, bucketAssignments, filterBuckets);
    const msaSet = new Set(filtered.map(item => item.MSA));
    
    return msaSet;
  }, [attractivenessData, globalFilters, bucketAssignments, filterBuckets]);

  // Filter data for opportunities (Included_In_Ranking = true)
  const filteredData = useMemo(() => {
    const filtered = data.filter(item => {
      // First check global filters
      const matchesGlobalFilters = globalFilteredMSAs.has(item.MSA);
      
      const matchesProvider = selectedProviders.size === 0 || selectedProviders.has(item.Provider);
      const matchesCategory = selectedCategory === "all" || item.Opportunity_Category === selectedCategory;
      const matchesAttractiveness = selectedAttractiveness === "all" || item.Attractiveness_Category === selectedAttractiveness;
      const matchesMSA = selectedMSA === "all" || item.MSA === selectedMSA;

      return matchesGlobalFilters && matchesProvider && matchesCategory && matchesAttractiveness && matchesMSA;
    });
    
    return filtered;
  }, [data, selectedProviders, selectedCategory, selectedAttractiveness, selectedMSA, globalFilteredMSAs]);

  // Filter data WITHOUT MSA filter - used for national metrics when MSA is selected
  const filteredDataWithoutMSA = useMemo(() => {
    const filtered = data.filter(item => {
      // First check global filters
      const matchesGlobalFilters = globalFilteredMSAs.has(item.MSA);
      
      const matchesProvider = selectedProviders.size === 0 || selectedProviders.has(item.Provider);
      const matchesCategory = selectedCategory === "all" || item.Opportunity_Category === selectedCategory;
      const matchesAttractiveness = selectedAttractiveness === "all" || item.Attractiveness_Category === selectedAttractiveness;
      // NOTE: Intentionally NOT filtering by MSA here

      return matchesGlobalFilters && matchesProvider && matchesCategory && matchesAttractiveness;
    });
    
    return filtered;
  }, [data, selectedProviders, selectedCategory, selectedAttractiveness, globalFilteredMSAs]);

  // Filter market data (ALL records) - used for provider market share analysis
  const filteredMarketData = useMemo(() => {
    const filtered = marketData.filter(item => {
      // First check global filters
      const matchesGlobalFilters = globalFilteredMSAs.has(item.MSA);
      
      // DON'T filter by selectedProvider here - we need ALL providers to determine market leaders
      const matchesCategory = selectedCategory === "all" || item.Opportunity_Category === selectedCategory;
      const matchesAttractiveness = selectedAttractiveness === "all" || item.Attractiveness_Category === selectedAttractiveness;
      const matchesMSA = selectedMSA === "all" || item.MSA === selectedMSA;

      return matchesGlobalFilters && matchesCategory && matchesAttractiveness && matchesMSA;
    });
    
    return filtered;
  }, [marketData, selectedCategory, selectedAttractiveness, selectedMSA, globalFilteredMSAs]);

  // Calculate distributions
  const categoryDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    filteredData.forEach(item => {
      distribution[item.Opportunity_Category] = 
        (distribution[item.Opportunity_Category] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const marketShareDistribution = useMemo(() => {
    if (selectedProviders.size > 0) {
      // Normalize attractiveness category to ensure consistent ordering
      const normalizeAttractiveness = (category: string): string => {
        const normalized = category.trim().toLowerCase();
        if (normalized.includes("highly attractive")) return "Highly Attractive";
        if (normalized === "attractive") return "Attractive";
        if (normalized.includes("neutral")) return "Neutral";
        if (normalized.includes("challenging")) return "Challenging";
        return category;
      };
      
      // Group by MSA and Opportunity/Attractiveness combination
      const groupMap = new Map<string, {
        msa: string;
        opportunityCategory: string;
        attractivenessCategory: string;
        totalMarketSize: number;
        avgMarketShare: number;
        count: number;
      }>();
      
      filteredData.forEach(item => {
        const normalizedAttr = normalizeAttractiveness(item.Attractiveness_Category);
        const key = `${item.MSA}-${item.Opportunity_Category}-${normalizedAttr}`;
        const existing = groupMap.get(key);
        const marketSize = parseFloat(String(item["Market Size"] || 0));
        const marketShare = parseFloat(String(item["Market Share"] || 0)) * 100;
        
        if (existing) {
          existing.totalMarketSize += marketSize;
          existing.avgMarketShare = (existing.avgMarketShare * existing.count + marketShare) / (existing.count + 1);
          existing.count += 1;
        } else {
          groupMap.set(key, {
            msa: item.MSA,
            opportunityCategory: item.Opportunity_Category,
            attractivenessCategory: normalizedAttr,
            totalMarketSize: marketSize,
            avgMarketShare: marketShare,
            count: 1,
          });
        }
      });
      
      return Array.from(groupMap.values());
    }
    
    // Clustered bar chart data for all providers (by opportunity category)
    const clusteredData: Record<string, Record<string, number>> = {
      "0-10%": {},
      "10-20%": {},
      "20-30%": {},
      "30-40%": {},
      "40%+": {},
    };
    
    const categories = ["Excellent", "Good", "Fair", "Poor"];
    categories.forEach(cat => {
      Object.keys(clusteredData).forEach(range => {
        clusteredData[range][cat] = 0;
      });
    });
    
    filteredData.forEach(item => {
      const share = parseFloat(String(item["Market Share"] || 0)) * 100;
      const category = item.Opportunity_Category;
      
      let range = "0-10%";
      if (share >= 40) range = "40%+";
      else if (share >= 30) range = "30-40%";
      else if (share >= 20) range = "20-30%";
      else if (share >= 10) range = "10-20%";
      
      if (clusteredData[range] && category) {
        clusteredData[range][category] = (clusteredData[range][category] || 0) + 1;
      }
    });
    
    return Object.entries(clusteredData).map(([name, values]) => ({
      name,
      ...values,
    }));
  }, [filteredData, selectedProviders]);

  const topOpportunities = useMemo(() => {
    // Use the pre-calculated Defensive_Value from the data (calculated in fetchOpportunities)
    const sorted = [...filteredData].sort((a, b) => {
      // Primary sort: Defensive Value Score (descending - higher is better)
      // This was already calculated and stored in the data object
      const defensiveValueA = (a as any).Defensive_Value || 0;
      const defensiveValueB = (b as any).Defensive_Value || 0;
      
      if (defensiveValueA !== defensiveValueB) {
        return defensiveValueB - defensiveValueA;
      }
      
      // Secondary sort: Market Share × Market Size (descending - higher is better)
      const marketShareA = parseFloat(String(a["Market Share"] || 0));
      const marketSizeA = parseFloat(String(a["Market Size"] || 0));
      const marketShareB = parseFloat(String(b["Market Share"] || 0));
      const marketSizeB = parseFloat(String(b["Market Size"] || 0));
      const valueA = marketShareA * marketSizeA;
      const valueB = marketShareB * marketSizeB;
      return valueB - valueA;
    });
    
    return sorted.slice(0, 15);
  }, [filteredData]);

  // Provider distribution - uses ALL market data (not filtered by Included_In_Ranking)
  const providerDistribution = useMemo(() => {
    // Use filtered MARKET data (includes all records, respects user filters)
    const dataToUse = filteredMarketData;
    
    // Group by provider and use the Market Share value directly from database
    const providerShares: Record<string, number> = {};
    
    dataToUse.forEach((item) => {
      const provider = item.Provider;
      const marketShareDecimal = parseFloat(String(item["Market Share"] || 0));
      
      // Just use the first/any Market Share value we find for this provider
      // Since when MSA is filtered, there should be consistent values per provider
      if (!providerShares[provider]) {
        providerShares[provider] = marketShareDecimal;
      }
    });
    
    // Return the direct database values, multiplied by 100 to convert to percentage
    const result = Object.entries(providerShares)
      .map(([name, value]) => ({ 
        name, 
        value: parseFloat((value * 100).toFixed(2))
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
    
    return result;
  }, [filteredMarketData]);



  const getOpportunityBadgeColor = (category: string) => {
    if (category === "Excellent") return "bg-green-100 text-green-800 border-green-300";
    if (category === "Good") return "bg-blue-100 text-blue-800 border-blue-300";
    if (category === "Fair") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-orange-100 text-orange-800 border-orange-300";
  };

  const getAttractivenessColor = (category: string) => {
    if (!category) return "bg-gray-100 text-gray-800 border-gray-300";
    const normalized = category.trim().toLowerCase();
    if (normalized.includes("highly attractive")) return "bg-green-100 text-green-800 border-green-300";
    if (normalized === "attractive") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (normalized.includes("neutral")) return "bg-orange-100 text-orange-800 border-orange-300";
    if (normalized.includes("challenging")) return "bg-red-100 text-red-800 border-red-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  // Handle analyze button click
  const handleAnalyze = async () => {
    if (selectedProviders.size > 0) {
      // Get all opportunities for selected providers
      const franchisesToAnalyze = topOpportunities.filter(opp => 
        selectedProviders.has(opp.Provider)
      );
      
      // Fetch deposit data for HHI calculations
      try {
        const depositData = await fetchDepositData();
        onAnalyzeSelected(franchisesToAnalyze, allProviders, marketData, depositData);
      } catch (error) {
        console.error("Error fetching deposit data:", error);
        onAnalyzeSelected(franchisesToAnalyze, allProviders, marketData, []);
      }
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={fetchOpportunities}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <Card className="p-4">
        <h3 className="mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Franchise Filter */}
          <div className="space-y-2">
            <Label>Franchise</Label>
            <Popover open={providerComboboxOpen} onOpenChange={setProviderComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={providerComboboxOpen}
                  className="w-full justify-between"
                >
                  {selectedProviders.size === 0
                    ? "Select franchises..."
                    : selectedProviders.size === 1
                      ? Array.from(selectedProviders)[0]
                      : `${selectedProviders.size} franchises selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search franchises..." />
                  <CommandList>
                    <CommandEmpty>No franchise found.</CommandEmpty>
                    <CommandGroup>
                      {providers.map((provider) => (
                        <CommandItem
                          key={provider}
                          value={provider}
                          onSelect={(currentValue) => {
                            const newSet = new Set(selectedProviders);
                            if (newSet.has(currentValue)) {
                              newSet.delete(currentValue);
                            } else {
                              newSet.add(currentValue);
                            }
                            setSelectedProviders(newSet);
                          }}
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedProviders.has(provider)
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}>
                            <Check className="h-4 w-4" />
                          </div>
                          {provider}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedProviders.size > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Array.from(selectedProviders).map((provider) => (
                  <Badge 
                    key={provider} 
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => {
                      const newSet = new Set(selectedProviders);
                      newSet.delete(provider);
                      setSelectedProviders(newSet);
                    }}
                  >
                    {provider}
                    <span className="ml-1">×</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <Label>Opportunity</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Excellent">Excellent</SelectItem>
                <SelectItem value="Good">Good</SelectItem>
                <SelectItem value="Fair">Fair</SelectItem>
                <SelectItem value="Poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Attractiveness Filter */}
          <div className="space-y-2">
            <Label>Attractiveness</Label>
            <Select value={selectedAttractiveness} onValueChange={setSelectedAttractiveness}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {attractivenessCategories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.replace(" Attractiveness", "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* MSA Filter */}
          <div className="space-y-2">
            <Label>MSA</Label>
            <Popover open={msaComboboxOpen} onOpenChange={setMsaComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={msaComboboxOpen}
                  className="w-full justify-between"
                >
                  {selectedMSA === "all" ? "All MSAs" : selectedMSA}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search MSA..." />
                  <CommandList>
                    <CommandEmpty>No MSA found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedMSA("all");
                          setMsaComboboxOpen(false);
                        }}
                      >
                        All MSAs
                      </CommandItem>
                      {msas.map((msa) => (
                        <CommandItem
                          key={msa}
                          value={msa}
                          onSelect={(currentValue) => {
                            setSelectedMSA(currentValue);
                            setMsaComboboxOpen(false);
                          }}
                        >
                          {msa}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active Filters Summary */}
        <div className="mt-4 flex items-center gap-2 text-sm">
          {globalFilteredMSAs.size < new Set(attractivenessData.map(m => m.MSA)).size && (
            <div className="text-xs bg-blue-50 px-3 py-1 rounded-full border border-blue-200 text-blue-700">
              {globalFilteredMSAs.size} MSAs match global filters
            </div>
          )}
          <span className="text-muted-foreground">
            Showing {filteredData.length} of {data.length} opportunities
          </span>
          {(selectedProviders.size > 0 || 
            selectedCategory !== "all" || selectedAttractiveness !== "all" || selectedMSA !== "all") && (
            <button
              onClick={() => {
                setSelectedProviders(new Set());
                setSelectedCategory("all");
                setSelectedAttractiveness("all");
                setSelectedMSA("all");
              }}
              className="text-primary hover:underline text-sm"
            >
              Clear page filters
            </button>
          )}
        </div>
      </Card>

      {/* Franchise Comparison Tables */}
      {(selectedProviders.size > 0 || selectedMSA !== "all") && (() => {
        // Determine which providers to show:
        // - If specific franchises are selected, show those
        // - If only MSA is selected (no franchises), show all franchises in that MSA
        const providersToShow = selectedProviders.size > 0 
          ? selectedProviders 
          : new Set(filteredData.map(opp => opp.Provider));
        
        // When MSA is selected (but no specific franchises), use national data for calculations
        // Otherwise use MSA-filtered data
        const dataForNationalMetrics = selectedMSA !== "all" && selectedProviders.size === 0
          ? filteredDataWithoutMSA.filter(opp => providersToShow.has(opp.Provider))
          : filteredData.filter(opp => providersToShow.has(opp.Provider));
        
        // Get all opportunities for selected providers
        const selectedProviderOpportunities = dataForNationalMetrics;
        
        // Calculate total market size across ALL MSAs in the dataset
        const msaMarketSizes = new Map<string, number>();
        attractivenessData.forEach(item => {
          const marketSize = parseFloat(String(item["Market Size"] || 0));
          if (!msaMarketSizes.has(item.MSA)) {
            msaMarketSizes.set(item.MSA, marketSize);
          }
        });
        const totalNationalMarketSize = Array.from(msaMarketSizes.values()).reduce((sum, size) => sum + size, 0);
        
        // Calculate aggregate metrics for each provider
        const providerAggregates = Array.from(providersToShow).map(provider => {
          const providerOpps = selectedProviderOpportunities.filter(opp => opp.Provider === provider);
          
          // Count unique MSAs
          const msaCount = new Set(providerOpps.map(opp => opp.MSA)).size;
          
          // Sum up franchise share dollars across all MSAs
          const totalFranchiseShareDollars = providerOpps.reduce((sum, opp) => {
            const marketShare = parseFloat(String(opp["Market Share"] || 0));
            const marketSize = parseFloat(String(opp["Market Size"] || 0));
            return sum + (marketShare * marketSize);
          }, 0);
          
          // Calculate national market share percentage
          const nationalMarketSharePct = totalNationalMarketSize === 0 ? 0 : (totalFranchiseShareDollars / totalNationalMarketSize) * 100;
          
          // Sum up market share at risk
          const totalAtRiskDollars = providerOpps.reduce((sum, opp) => {
            return sum + parseFloat(String(opp["Defend $"] || 0));
          }, 0);
          
          // Calculate percentage at risk
          const percentageAtRisk = totalFranchiseShareDollars === 0 ? 0 : (totalAtRiskDollars / totalFranchiseShareDollars) * 100;
          
          // Calculate MSAs that contribute to top 30% of revenue
          const msaRevenues = providerOpps.map(opp => {
            const marketShare = parseFloat(String(opp["Market Share"] || 0));
            const marketSize = parseFloat(String(opp["Market Size"] || 0));
            const revenue = marketShare * marketSize;
            return {
              msa: opp.MSA,
              revenue: revenue,
              revenuePercentage: totalFranchiseShareDollars === 0 ? 0 : (revenue / totalFranchiseShareDollars) * 100,
              attractiveness: opp.Attractiveness_Category
            };
          });
          
          // Sort by revenue descending
          msaRevenues.sort((a, b) => b.revenue - a.revenue);
          
          // Find MSAs that make up top 30% of revenue
          const targetRevenue = totalFranchiseShareDollars * 0.30;
          let cumulativeRevenue = 0;
          const top30MSAs: Array<{msa: string, percentage: number}> = [];
          
          for (const msaRev of msaRevenues) {
            if (cumulativeRevenue >= targetRevenue) break;
            top30MSAs.push({
              msa: msaRev.msa,
              percentage: msaRev.revenuePercentage
            });
            cumulativeRevenue += msaRev.revenue;
          }
          
          // Calculate revenue distribution by market attractiveness
          const revenueByAttractiveness = {
            good: 0,      // Highly Attractive + Attractive
            neutral: 0,   // Neutral
            challenging: 0 // Challenging
          };
          
          msaRevenues.forEach(msaRev => {
            if (msaRev.attractiveness === "Highly Attractive" || msaRev.attractiveness === "Attractive") {
              revenueByAttractiveness.good += msaRev.revenue;
            } else if (msaRev.attractiveness === "Neutral") {
              revenueByAttractiveness.neutral += msaRev.revenue;
            } else if (msaRev.attractiveness === "Challenging") {
              revenueByAttractiveness.challenging += msaRev.revenue;
            }
          });
          
          // Convert to percentages
          const revenueByAttractivenessPercent = {
            good: totalFranchiseShareDollars === 0 ? 0 : (revenueByAttractiveness.good / totalFranchiseShareDollars) * 100,
            neutral: totalFranchiseShareDollars === 0 ? 0 : (revenueByAttractiveness.neutral / totalFranchiseShareDollars) * 100,
            challenging: totalFranchiseShareDollars === 0 ? 0 : (revenueByAttractiveness.challenging / totalFranchiseShareDollars) * 100
          };
          
          // Calculate average customer satisfaction score from Weighted_Average_Score
          const satisfactionScores = providerOpps
            .map(opp => (opp as any).Weighted_Average_Score)
            .filter(score => score !== null && score !== undefined && !isNaN(score));
          
          const customerSatisfactionScore = satisfactionScores.length > 0
            ? satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length
            : null;
          
          return {
            provider,
            msaCount,
            totalFranchiseShareDollars,
            nationalMarketSharePct,
            totalAtRiskDollars,
            percentageAtRisk,
            top30MSAs,
            revenueByAttractivenessPercent,
            customerSatisfactionScore
          };
        });
        
        return (
          <div className="space-y-4">
            {/* Analyze Button */}
            <div className="flex justify-end">
              <Button 
                onClick={async () => {
                  console.log('TargetOpportunities - Analyze button clicked');
                  console.log('TargetOpportunities - tableSelectedProviders:', Array.from(tableSelectedProviders));
                  
                  // Update selectedProviders state to match tableSelectedProviders
                  setSelectedProviders(new Set(tableSelectedProviders));
                  
                  // Get all opportunities for selected providers from the table
                  const franchisesToAnalyze = filteredData.filter(opp => 
                    tableSelectedProviders.has(opp.Provider)
                  );
                  
                  console.log('TargetOpportunities - franchisesToAnalyze:', {
                    count: franchisesToAnalyze.length,
                    sample: franchisesToAnalyze.slice(0, 2),
                    providers: Array.from(new Set(franchisesToAnalyze.map(f => f.Provider)))
                  });
                  console.log('TargetOpportunities - allProviders count:', allProviders.length);
                  console.log('TargetOpportunities - marketData count:', marketData.length);
                  
                  // Fetch deposit data for HHI calculations
                  try {
                    const depositDataResponse = await fetchDepositData();
                    console.log('TargetOpportunities - depositData count:', depositDataResponse.length);
                    
                    // Store data and open modal
                    setAnalysisData({
                      franchises: franchisesToAnalyze,
                      providers: allProviders,
                      market: marketData,
                      deposits: depositDataResponse
                    });
                    setIsAnalysisModalOpen(true);
                  } catch (error) {
                    console.error("Error fetching deposit data for proforma acquisition analysis:", error);
                    
                    // Store data with empty deposits and open modal
                    setAnalysisData({
                      franchises: franchisesToAnalyze,
                      providers: allProviders,
                      market: marketData,
                      deposits: []
                    });
                    setIsAnalysisModalOpen(true);
                  }
                }}
                disabled={tableSelectedProviders.size === 0}
                className="gap-2"
                size="lg"
              >
                <Target className="h-4 w-4" />
                Analyze Selected ({tableSelectedProviders.size})
              </Button>
            </div>

            {/* Summary Comparison Table */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="mb-0">Franchise Comparison Summary</h3>
                      {selectedMSA !== "all" && selectedProviders.size === 0 && (
                        <Badge variant="secondary" className="text-xs">
                          MSA: {selectedMSA}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedMSA !== "all" && selectedProviders.size === 0 
                        ? `Showing national-level metrics for ${providersToShow.size} franchise${providersToShow.size > 1 ? 's' : ''} operating in this MSA`
                        : `National-level aggregate metrics · ${providersToShow.size} franchise${providersToShow.size > 1 ? 's' : ''} available`}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 bg-muted/50 sticky left-0 z-10">
                        <span className="font-medium text-sm">Metric</span>
                      </th>
                      {providerAggregates.map((agg, idx) => (
                        <th key={idx} className="py-3 px-4 min-w-[180px] border-l">
                          <div className="flex flex-col items-center gap-2">
                            <Checkbox 
                              checked={tableSelectedProviders.has(agg.provider)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(tableSelectedProviders);
                                if (checked) {
                                  newSelected.add(agg.provider);
                                } else {
                                  newSelected.delete(agg.provider);
                                }
                                setTableSelectedProviders(newSelected);
                              }}
                            />
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-medium text-sm truncate max-w-[150px]" title={agg.provider}>{agg.provider}</span>
                              <span className="text-xs text-muted-foreground">National Aggregate</span>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Number of MSAs Active Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">MSAs Active</td>
                      {providerAggregates.map((agg, idx) => (
                        <td key={idx} className="py-3 px-4 text-center border-l">
                          {agg.msaCount}
                        </td>
                      ))}
                    </tr>
                    
                    {/* National Market Share (%) Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">National Market Share (%)</td>
                      {providerAggregates.map((agg, idx) => (
                        <td key={idx} className="py-3 px-4 text-center border-l font-medium">
                          {agg.nationalMarketSharePct.toFixed(2)}%
                        </td>
                      ))}
                    </tr>
                    
                    {/* Total Franchise Share ($) Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">Total Franchise Share ($)</td>
                      {providerAggregates.map((agg, idx) => (
                        <td key={idx} className="py-3 px-4 text-center border-l">
                          {formatCurrency(agg.totalFranchiseShareDollars)}
                        </td>
                      ))}
                    </tr>
                    
                    {/* Total Market Share at Risk ($) Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">Total Market Share at Risk ($)</td>
                      {providerAggregates.map((agg, idx) => (
                        <td key={idx} className="py-3 px-4 text-center border-l">
                          {formatCurrency(agg.totalAtRiskDollars)}
                        </td>
                      ))}
                    </tr>
                    
                    {/* Market Share at Risk (%) Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">Market Share at Risk (%)</td>
                      {providerAggregates.map((agg, idx) => {
                        const risk = agg.percentageAtRisk;
                        let displayValue: string;
                        if (risk < 5) displayValue = "<5%";
                        else if (risk > 25) displayValue = ">25%";
                        else displayValue = `${risk.toFixed(1)}%`;
                        
                        return (
                          <td key={idx} className="py-3 px-4 text-center border-l">
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* Overall Satisfaction Score Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">Overall Satisfaction Score</td>
                      {providerAggregates.map((agg, idx) => {
                        const score = agg.customerSatisfactionScore;
                        // Convert from 0-5 scale to 0-100 scale
                        const scoreOutOf100 = score !== null ? score * 20 : null;
                        
                        return (
                          <td key={idx} className="py-3 px-4 text-center border-l">
                            {scoreOutOf100 !== null ? (
                              <span className="font-medium">
                                {scoreOutOf100.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    
                    {/* Top 30% of Revenues Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">Top 30% of Revenues</td>
                      {providerAggregates.map((agg, idx) => (
                        <td key={idx} className="py-3 px-4 text-center border-l text-xs">
                          {agg.top30MSAs.length > 0 
                            ? agg.top30MSAs.map(item => `${item.msa} (${item.percentage.toFixed(1)}%)`).join(", ")
                            : "—"}
                        </td>
                      ))}
                    </tr>
                    
                    {/* Separator Row */}
                    <tr className="border-b-2 border-muted">
                      <td colSpan={providerAggregates.length + 1} className="py-4 px-4 bg-muted/50">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm">Franchise Quality by Market Attractiveness</span>
                          <span className="text-xs text-muted-foreground">
                            Good = Highly Attractive + Attractive MSAs · Neutral = Neutral MSAs · Challenging = Challenging MSAs
                          </span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Revenue in Good MSAs Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">Revenue in Good MSAs (%)</td>
                      {providerAggregates.map((agg, idx) => (
                        <td key={idx} className="py-3 px-4 text-center border-l">
                          {agg.revenueByAttractivenessPercent.good.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                    
                    {/* Revenue in Neutral MSAs Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">Revenue in Neutral MSAs (%)</td>
                      {providerAggregates.map((agg, idx) => (
                        <td key={idx} className="py-3 px-4 text-center border-l">
                          {agg.revenueByAttractivenessPercent.neutral.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                    
                    {/* Revenue in Challenging MSAs Row */}
                    <tr className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium bg-muted/30 sticky left-0 z-10 text-sm">Revenue in Challenging MSAs (%)</td>
                      {providerAggregates.map((agg, idx) => (
                        <td key={idx} className="py-3 px-4 text-center border-l">
                          {agg.revenueByAttractivenessPercent.challenging.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                  </tbody>
                  
                  {/* Heatmap Section - Franchise Dominance by MSA */}
                  <tbody>
                    <tr>
                      <td colSpan={providerAggregates.length + 1} className="py-4 px-4 bg-muted/50 border-t-2 border-muted">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-sm">Franchise Dominance by MSA</span>
                          <span className="text-xs text-muted-foreground">
                            Market share distribution across top MSAs
                          </span>
                        </div>
                      </td>
                    </tr>
                    {(() => {
                      // Group MSAs by attractiveness category and get all MSAs by market size
                      const msaData = new Map<string, { category: string; marketSize: number }>();
                      
                      selectedProviderOpportunities.forEach(opp => {
                        const msa = opp.MSA;
                        const marketSize = parseFloat(String(opp["Market Size"] || 0));
                        const category = opp.Attractiveness_Category || 'Unknown';
                        
                        if (!msaData.has(msa) || msaData.get(msa)!.marketSize < marketSize) {
                          msaData.set(msa, { category, marketSize });
                        }
                      });
                      
                      // Get all MSAs by market size (sorted, no limit)
                      const allMSAsData = Array.from(msaData.entries())
                        .sort((a, b) => b[1].marketSize - a[1].marketSize);
                      
                      // Group by category
                      const categoryOrder = ['Highly Attractive', 'Attractive', 'Neutral', 'Challenging', 'Unknown'];
                      const groupedMSAs = categoryOrder.map(category => ({
                        category,
                        msas: allMSAsData
                          .filter(([, data]) => data.category === category)
                          .map(([msa]) => msa)
                          .sort()
                      })).filter(group => group.msas.length > 0);
                      
                      const providers = Array.from(providersToShow);
                      
                      return groupedMSAs.flatMap((group, groupIdx) => [
                        // Category Header Row
                        <tr key={`category-${groupIdx}`} className="bg-muted/70">
                          <td colSpan={providerAggregates.length + 1} className="py-2 px-4 font-semibold border sticky left-0 z-10">
                            {group.category}
                          </td>
                        </tr>,
                        // MSA Rows
                        ...group.msas.map((msa, msaIdx) => {
                          const msaOpps = selectedProviderOpportunities.filter(opp => opp.MSA === msa);
                          const sharesByProvider = new Map<string, number>();
                          msaOpps.forEach(opp => {
                            sharesByProvider.set(opp.Provider, parseFloat(String(opp["Market Share"] || 0)) * 100);
                          });
                          
                          const maxShare = Math.max(...Array.from(sharesByProvider.values()));
                          
                          return (
                            <tr key={`${groupIdx}-${msaIdx}`} className="hover:bg-muted/50 transition-colors">
                              <td className="py-2 px-4 border font-medium bg-muted/30 sticky left-0 z-10 text-sm">
                                <div className="truncate max-w-[200px]" title={msa}>{msa}</div>
                              </td>
                              {providerAggregates.map((agg, pIdx) => {
                                const share = sharesByProvider.get(agg.provider) || 0;
                                const maxShareInRow = Math.max(...Array.from(sharesByProvider.values()));
                                const isDominant = share === maxShareInRow && share > 0;
                                const intensity = maxShareInRow > 0 ? share / maxShareInRow : 0;
                                
                                return (
                                  <td 
                                    key={pIdx} 
                                    className="py-2 px-4 border text-center text-sm border-l"
                                    style={{
                                      backgroundColor: share > 0 
                                        ? `rgba(59, 130, 246, ${0.05 + intensity * 0.25})`
                                        : 'transparent'
                                    }}
                                  >
                                    <span className={isDominant ? 'font-bold' : ''}>
                                      {share > 0 ? `${share.toFixed(1)}%` : '—'}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      ]);
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      })()}
      
      {selectedProviders.size === 0 && selectedMSA === "all" && (
        <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-2">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="mb-2">No Franchises or MSA Selected</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Select one or more franchises from the Franchise filter, or select an MSA to view detailed comparison and market share distribution for all franchises in that market.
            </p>
          </div>
        </Card>
      )}

      {/* Performance Across Market Types - Only shown when provider is selected */}
      {false && (
        <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="mb-0">Performance Across Market Types</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Business distribution and market share across Good, Neutral, and Challenging markets
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Market Share by MSA */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-4">Market Share by MSA & Quality</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(() => {
                    // First, determine market leaders by comparing all providers in each MSA
                    const msaLeaderMap = new Map<string, string>(); // MSA -> Provider with highest share
                    
                    // Check all market data (not just filtered) to find true market leaders
                    filteredMarketData.forEach(item => {
                      const msaKey = item.MSA;
                      const currentShare = parseFloat(String(item["Market Share"] || 0));
                      
                      if (!msaLeaderMap.has(msaKey)) {
                        msaLeaderMap.set(msaKey, item.Provider);
                      } else {
                        // Check if this provider has higher share
                        const currentLeader = msaLeaderMap.get(msaKey);
                        const currentLeaderShare = filteredMarketData
                          .find(d => d.MSA === msaKey && d.Provider === currentLeader)
                          ?.["Market Share"];
                        
                        if (currentShare > parseFloat(String(currentLeaderShare || 0))) {
                          msaLeaderMap.set(msaKey, item.Provider);
                        }
                      }
                    });
                    
                    // Get unique MSAs with their data for selected provider
                    const msaDataMap = new Map<string, {
                      msa: string;
                      marketShare: number;
                      businessSize: number;
                      attractivenessCategory: string;
                      isLeader: boolean;
                      rank: number;
                      color: string;
                    }>();
                    
                    filteredData.forEach(opp => {
                      if (opp.Provider !== selectedProvider) return;
                      
                      const msaKey = opp.MSA;
                      if (!msaDataMap.has(msaKey)) {
                        const marketShare = parseFloat(String(opp["Market Share"] || 0)) * 100;
                        const marketSize = parseFloat(String(opp["Market Size"] || 0));
                        const businessSize = marketShare * marketSize / 100;
                        
                        // Check if this provider is the market leader in this MSA
                        const isLeader = msaLeaderMap.get(msaKey) === selectedProvider;
                        
                        // Normalize attractiveness category
                        const normalized = opp.Attractiveness_Category?.toLowerCase() || "";
                        let category = "Unknown";
                        let color = "#94a3b8"; // default gray
                        
                        if (normalized.includes("highly attractive")) {
                          category = "Highly Attractive";
                          color = "#22c55e";
                        } else if (normalized === "attractive") {
                          category = "Attractive";
                          color = "#eab308";
                        } else if (normalized.includes("neutral")) {
                          category = "Neutral";
                          color = "#f97316";
                        } else if (normalized.includes("challenging")) {
                          category = "Challenging";
                          color = "#ef4444";
                        }
                        
                        msaDataMap.set(msaKey, {
                          msa: isLeader ? `👑 ${opp.MSA}` : opp.MSA,
                          marketShare: marketShare,
                          businessSize: businessSize,
                          attractivenessCategory: category,
                          isLeader: isLeader,
                          rank: opp.Provider_Opportunity_Rank || 0,
                          color: color,
                        });
                      }
                    });
                    
                    // Sort by market share descending and take top 10
                    const result = Array.from(msaDataMap.values())
                      .sort((a, b) => b.marketShare - a.marketShare)
                      .slice(0, 10);
                    
                    return result;
                  })()}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-20" />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="opacity-60"
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                  />
                  <YAxis 
                    type="category"
                    dataKey="msa"
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="opacity-60"
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(1)}%`,
                      'Market Share'
                    ]}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        const data = payload[0].payload;
                        return `${data.msa.replace('👑 ', '')} - ${data.attractivenessCategory}`;
                      }
                      return label;
                    }}
                  />
                  <Bar dataKey="marketShare" radius={[0, 4, 4, 0]}>
                    {(() => {
                      const msaDataMap = new Map<string, {
                        msa: string;
                        marketShare: number;
                        businessSize: number;
                        attractivenessCategory: string;
                        isLeader: boolean;
                        rank: number;
                        color: string;
                      }>();
                      
                      filteredData.forEach(opp => {
                        if (opp.Provider !== selectedProvider) return;
                        
                        const msaKey = opp.MSA;
                        if (!msaDataMap.has(msaKey)) {
                          const marketShare = parseFloat(String(opp["Market Share"] || 0)) * 100;
                          const marketSize = parseFloat(String(opp["Market Size"] || 0));
                          const businessSize = marketShare * marketSize / 100;
                          const rank = opp.Provider_Opportunity_Rank || 0;
                          
                          const normalized = opp.Attractiveness_Category?.toLowerCase() || "";
                          let category = "Unknown";
                          let color = "#94a3b8";
                          
                          if (normalized.includes("highly attractive")) {
                            category = "Highly Attractive";
                            color = "#22c55e";
                          } else if (normalized === "attractive") {
                            category = "Attractive";
                            color = "#eab308";
                          } else if (normalized.includes("neutral")) {
                            category = "Neutral";
                            color = "#f97316";
                          } else if (normalized.includes("challenging")) {
                            category = "Challenging";
                            color = "#ef4444";
                          }
                          
                          msaDataMap.set(msaKey, {
                            msa: rank === 1 ? `👑 ${opp.MSA}` : opp.MSA,
                            marketShare: marketShare,
                            businessSize: businessSize,
                            attractivenessCategory: category,
                            isLeader: rank === 1,
                            rank: rank,
                            color: color,
                          });
                        }
                      });
                      
                      const sortedData = Array.from(msaDataMap.values())
                        .sort((a, b) => b.marketShare - a.marketShare)
                        .slice(0, 10);
                      
                      return sortedData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          stroke={entry.isLeader ? "#fbbf24" : "none"}
                          strokeWidth={entry.isLeader ? 3 : 0}
                          opacity={entry.isLeader ? 1 : 0.85}
                        />
                      ));
                    })()}
                    <LabelList 
                      dataKey="marketShare" 
                      position="right"
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      style={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: "#22c55e" }}></span>
                  <span>Highly Attractive</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: "#eab308" }}></span>
                  <span>Attractive</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: "#f97316" }}></span>
                  <span>Neutral</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: "#ef4444" }}></span>
                  <span>Challenging</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>👑 Market Leader</span>
                </div>
              </div>
            </div>

            {/* Market Type Summary Table */}
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-4">Market Type Summary</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Market Type</th>
                      <th className="text-right py-2 px-2">Business Size</th>
                      <th className="text-right py-2 px-2">% of Total</th>
                      <th className="text-right py-2 px-2"># of MSAs</th>
                      <th className="text-right py-2 px-2">Market Share at Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const goodMarkets = providerDetailedAnalysis.qualityDistribution.filter(item => {
                        const normalized = item.category.toLowerCase();
                        return normalized.includes("highly attractive") || normalized === "attractive";
                      });
                      
                      const neutralMarkets = providerDetailedAnalysis.qualityDistribution.filter(item => {
                        const normalized = item.category.toLowerCase();
                        return normalized.includes("neutral");
                      });
                      
                      const challengingMarkets = providerDetailedAnalysis.qualityDistribution.filter(item => {
                        const normalized = item.category.toLowerCase();
                        return normalized.includes("challenging");
                      });
                      
                      const marketTypes = [
                        {
                          name: "Good",
                          markets: goodMarkets,
                          color: "#22c55e"
                        },
                        {
                          name: "Neutral",
                          markets: neutralMarkets,
                          color: "#eab308"
                        },
                        {
                          name: "Challenging",
                          markets: challengingMarkets,
                          color: "#ef4444"
                        }
                      ];
                      
                      return marketTypes.map((type, idx) => {
                        const businessSize = type.markets.reduce((sum, m) => sum + m.businessSize, 0);
                        const percentage = type.markets.reduce((sum, m) => sum + m.percentage, 0);
                        
                        // Get all opportunities for this market type
                        const typeOpportunities = filteredData.filter(opp => {
                          if (opp.Provider !== selectedProvider) return false;
                          const normalized = opp.Attractiveness_Category?.toLowerCase() || "";
                          
                          // Check if this MSA's category matches any in this type
                          if (type.name === "Good") {
                            return normalized.includes("highly attractive") || normalized === "attractive";
                          } else if (type.name === "Neutral") {
                            return normalized.includes("neutral");
                          } else if (type.name === "Challenging") {
                            return normalized.includes("challenging");
                          }
                          return false;
                        });
                        
                        // Count unique MSAs and collect ranks and market share at risk
                        const msaStatsMap = new Map<string, { bestRank: number, totalDefend: number }>();
                        
                        typeOpportunities.forEach(opp => {
                          const msaKey = opp.MSA;
                          const rank = opp.Provider_Opportunity_Rank || 0;
                          const defendValue = parseFloat(String(opp["Defend $"] || 0));
                          
                          if (!msaStatsMap.has(msaKey)) {
                            msaStatsMap.set(msaKey, { bestRank: rank, totalDefend: defendValue });
                          } else {
                            const existing = msaStatsMap.get(msaKey)!;
                            // Keep the best (lowest) rank for this MSA
                            if (rank > 0 && (existing.bestRank === 0 || rank < existing.bestRank)) {
                              existing.bestRank = rank;
                            }
                            // Sum up all defend values for this MSA
                            existing.totalDefend += defendValue;
                          }
                        });
                        
                        // Collect total market share at risk
                        let totalMarketShareAtRisk = 0;
                        
                        msaStatsMap.forEach(stats => {
                          totalMarketShareAtRisk += stats.totalDefend;
                        });
                        
                        const msaCount = msaStatsMap.size;
                        
                        return (
                          <tr key={idx} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: type.color }}
                                />
                                <span className="font-medium">{type.name}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right">{formatCurrency(businessSize)}</td>
                            <td className="py-2 px-2 text-right">{percentage.toFixed(1)}%</td>
                            <td className="py-2 px-2 text-right">{msaCount}</td>
                            <td className="py-2 px-2 text-right">{formatCurrency(totalMarketShareAtRisk)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Additional insights */}
              <div className="mt-4 space-y-2">
                {(() => {
                  const goodMarkets = providerDetailedAnalysis.qualityDistribution.filter(item => {
                    const normalized = item.category.toLowerCase();
                    return normalized.includes("highly attractive") || normalized === "attractive";
                  });
                  
                  const challengingMarkets = providerDetailedAnalysis.qualityDistribution.filter(item => {
                    const normalized = item.category.toLowerCase();
                    return normalized.includes("challenging");
                  });
                  
                  const goodPercentage = goodMarkets.reduce((sum, m) => sum + m.percentage, 0);
                  const challengingPercentage = challengingMarkets.reduce((sum, m) => sum + m.percentage, 0);
                  
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs bg-card/50 rounded p-2">
                        <span className="text-muted-foreground">Good Markets Ratio</span>
                        <span className={`font-semibold ${goodPercentage > 50 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {goodPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs bg-card/50 rounded p-2">
                        <span className="text-muted-foreground">Challenging Markets Ratio</span>
                        <span className={`font-semibold ${challengingPercentage > 30 ? 'text-red-600' : 'text-green-600'}`}>
                          {challengingPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Proforma Acquisition Analysis Modal */}
      <Dialog open={isAnalysisModalOpen} onOpenChange={setIsAnalysisModalOpen}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] h-[98vh] !max-h-[98vh] overflow-y-auto p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Proforma Acquisition Analysis</DialogTitle>
          {analysisData && (
            <AcquisitionAnalysis
              selectedFranchises={analysisData.franchises}
              allProviders={analysisData.providers}
              marketData={analysisData.market}
              depositData={analysisData.deposits}
              onBack={() => setIsAnalysisModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
