import React, { useState, useMemo, useEffect } from "react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ScatterChart, Scatter, ZAxis, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { Search, ChevronDown, ChevronUp, Download, Eye, Filter, TrendingUp, MapPin, Info, BarChart3, Maximize2, Target, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { calculateDefensiveValue, calculateBucketModeScore, calculateAttractivenessScore, getCategoriesByQuartiles, DEFAULT_BUCKET_ASSIGNMENTS } from "../utils/scoreCalculation";
import { applyGlobalFilters } from "../utils/applyGlobalFilters";
import { fetchFilterBuckets, fetchMSADetails } from "../utils/csvDataHooks";

interface MSAData {
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

interface MSAExplorerProps {
  data: MSAData[];
  weights: any;
  globalFilters?: any;
  bucketAssignments?: any;
  bucketWeights?: { high: number; medium: number };
}

interface OpportunityData {
  Provider: string;
  MSA: string;
  Product: string;
  "Market Share": string | number;
  "Defend $": string | number;
  "Market Size": string | number;
  Opportunity_Category: string;
  Attractiveness_Category: string;
  Included_In_Ranking?: boolean;
  Exclusion?: boolean;
}



export function MSAExplorer({ data, weights, globalFilters, bucketAssignments, bucketWeights = { high: 60, medium: 40 } }: MSAExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAttractiveness, setSelectedAttractiveness] = useState("all");
  const [selectedPricing, setSelectedPricing] = useState("all");
  const [selectedGrowth, setSelectedGrowth] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [showAllRows, setShowAllRows] = useState(false);
  const [msaOpportunities, setMsaOpportunities] = useState<Record<string, OpportunityData[]>>({});
  const [loadingOpportunities, setLoadingOpportunities] = useState<Set<string>>(new Set());
  const [filterBuckets, setFilterBuckets] = useState<{
    marketSize?: { range: { min: number; max: number } };
    revenuePerCompany?: { range: { min: number; max: number } };
  }>({});

  // Fetch filter buckets to properly apply global filters
  useEffect(() => {
    const fetchBuckets = async () => {
      try {
        const data = await fetchFilterBuckets();
        setFilterBuckets({
          marketSize: data.marketSize,
          revenuePerCompany: data.revenuePerCompany
        });
      } catch (error) {
        console.error("Error fetching filter buckets:", error);
      }
    };

    fetchBuckets();
  }, []);

  // Apply global filters first, then local filters
  const globallyFilteredData = useMemo(() => {
    // First apply global filters (market size, revenue, region, exclusions)
    // Note: data already has recalculated scores from App.tsx's calculatedMapData
    return globalFilters && bucketAssignments
      ? applyGlobalFilters(data, globalFilters, bucketAssignments, filterBuckets)
      : data;
  }, [data, globalFilters, bucketAssignments, filterBuckets]);

  const filteredData = useMemo(() => {
    // Debug: Check what data we're receiving
    const charlotte = globallyFilteredData.find(item => item.MSA.includes('Charlotte'));
    if (charlotte) {
      console.log('MSAExplorer: Charlotte data received:', {
        MSA: charlotte.MSA,
        Attractiveness_Score: charlotte.Attractiveness_Score,
        Attractiveness_Category: charlotte.Attractiveness_Category,
        dataSource: 'Should be from calculatedMapData'
      });
    }
    
    // Then apply local page-specific filters
    // Using globallyFilteredData directly since scores are already recalculated in App.tsx
    return globallyFilteredData.filter(item => {
      const matchesSearch = searchTerm === "" || 
        item.MSA.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAttractiveness = selectedAttractiveness === "all" || 
        item.Attractiveness_Category === selectedAttractiveness;
      const matchesPricing = selectedPricing === "all" || 
        item.Pricing_Rationality === selectedPricing;
      const matchesGrowth = selectedGrowth === "all" || 
        item.Economic_Growth_Score === selectedGrowth;

      return matchesSearch && matchesAttractiveness && 
             matchesPricing && matchesGrowth;
    });
  }, [globallyFilteredData, searchTerm, selectedAttractiveness, selectedPricing, selectedGrowth]);

  // Get badge color based on parameter type and value
  const getParameterColor = (parameterType: string, value: string): string => {
    if (!value) return "bg-gray-50 text-gray-700 border-gray-300";
    
    const normalized = value.toLowerCase();
    
    // Inverse scoring parameters (Low is good, High is bad)
    if (["HHI_Score", "Risk_Score", "Risk_Migration_Score"].includes(parameterType)) {
      if (normalized === "low") return "bg-green-50 text-green-700 border-green-300";
      if (normalized === "medium") return "bg-yellow-50 text-yellow-700 border-yellow-300";
      if (normalized === "high") return "bg-red-50 text-red-700 border-red-300";
    }
    
    // Relative Risk Migration (Below National is good, Above National is bad)
    if (parameterType === "Relative_Risk_Migration_Score") {
      if (normalized.includes("below")) return "bg-green-50 text-green-700 border-green-300";
      if (normalized.includes("at")) return "bg-yellow-50 text-yellow-700 border-yellow-300";
      if (normalized.includes("above")) return "bg-red-50 text-red-700 border-red-300";
    }
    
    // Premium/Discount (Premium is good, Discount is bad)
    if (parameterType === "Premium_Discount_Score") {
      if (normalized === "premium") return "bg-green-50 text-green-700 border-green-300";
      if (normalized === "par") return "bg-yellow-50 text-yellow-700 border-yellow-300";
      if (normalized === "discount") return "bg-red-50 text-red-700 border-red-300";
    }
    
    // Pricing Rationality (Rational is good, Irrational is bad)
    if (parameterType === "Pricing_Rationality_Score") {
      if (normalized === "rational") return "bg-green-50 text-green-700 border-green-300";
      if (normalized === "irrational") return "bg-red-50 text-red-700 border-red-300";
    }
    
    // Normal scoring parameters (High is good, Low is bad)
    if (["Economic_Growth_Score", "Loan_Growth_Score", "International_CM_Score"].includes(parameterType)) {
      if (normalized === "high") return "bg-green-50 text-green-700 border-green-300";
      if (normalized === "medium") return "bg-yellow-50 text-yellow-700 border-yellow-300";
      if (normalized === "low") return "bg-red-50 text-red-700 border-red-300";
    }
    
    return "bg-gray-50 text-gray-700 border-gray-300";
  };

  // Convert score text to numeric value (used for comparison radar chart)
  const scoreToValue = (score: string, isInverse: boolean = false): number => {
    if (!score) return 0;
    const normalized = score.toLowerCase().trim();
    
    // Special handling for Pricing_Rationality_Score
    // Values: "Rational", "Overpriced (Opportunity)", "Underpriced (Risk)"
    if (normalized.includes("rational")) return 3; // Best - rational pricing
    if (normalized.includes("overpriced") || normalized.includes("opportunity")) return 2; // Medium - opportunity
    if (normalized.includes("underpriced") || normalized.includes("risk")) return 1; // Worst - risk
    
    // Special handling for Premium_Discount_Score
    // Values: "Premium", "Par", "Discount"
    if (normalized === "premium") return 3; // Best - premium pricing power
    if (normalized === "par") return 2; // Medium - at market rate
    if (normalized === "discount") return 1; // Worst - discount pricing
    
    // For inverse scoring (lower is better)
    if (isInverse) {
      if (normalized === "high") return 1;
      if (normalized === "medium") return 2;
      if (normalized === "low") return 3;
      // For Relative Risk Migration
      if (normalized === "above_national") return 1;
      if (normalized === "at_national") return 2;
      if (normalized === "below_national") return 3;
      return 0;
    }
    
    // Standard scoring (higher is better)
    if (normalized === "high") return 3;
    if (normalized === "medium") return 2;
    if (normalized === "low") return 1;
    return 0;
  };

  // Get top MSAs by attractiveness score
  const topMSAs = useMemo(() => {
    const sorted = [...filteredData]
      .sort((a, b) => b.Attractiveness_Score - a.Attractiveness_Score);
    return showAllRows ? sorted : sorted.slice(0, 10);
  }, [filteredData, showAllRows]);

  // Toggle row expansion
  const toggleRowExpansion = (msa: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(msa)) {
      newExpanded.delete(msa);
    } else {
      newExpanded.add(msa);
      // Fetch opportunities when expanding if not already loaded
      if (!msaOpportunities[msa] && !loadingOpportunities.has(msa)) {
        fetchOpportunitiesForMSA(msa);
      }
    }
    setExpandedRows(newExpanded);
  };

  // Fetch opportunities for a single MSA
  const fetchOpportunitiesForMSA = async (msaName: string) => {
    setLoadingOpportunities(prev => new Set(prev).add(msaName));
    
    try {
      console.log(`MSAExplorer: Fetching opportunities for ${msaName}...`);
      const data = await fetchMSADetails(msaName);
      
      if (!data || !data.opportunities) {
        console.warn(`MSAExplorer: No opportunities data returned for ${msaName}`, data);
        setMsaOpportunities(prev => ({
          ...prev,
          [msaName]: []
        }));
        return;
      }
      
      const opportunities = data.opportunities || [];
      console.log(`MSAExplorer: Received ${opportunities.length} opportunities for ${msaName}`);
      
      // Sort opportunities by Market Share (descending - highest market share first)
      // NO FILTERS - show all opportunities regardless of Included_In_Ranking or Exclusion
      const sortedOpps = [...opportunities]
        .sort((a: any, b: any) => {
          const marketShareA = parseFloat(String(a["Market Share"] || 0));
          const marketShareB = parseFloat(String(b["Market Share"] || 0));
          return marketShareB - marketShareA;
        });
      
      console.log(`MSAExplorer: Showing all ${sortedOpps.length} opportunities for ${msaName} (no filters)`);
      
      setMsaOpportunities(prev => ({
        ...prev,
        [msaName]: sortedOpps
      }));
    } catch (error) {
      console.error(`MSAExplorer: Error fetching opportunities for ${msaName}:`, error);
      // Set empty array on error so UI doesn't hang
      setMsaOpportunities(prev => ({
        ...prev,
        [msaName]: []
      }));
    } finally {
      setLoadingOpportunities(prev => {
        const next = new Set(prev);
        next.delete(msaName);
        return next;
      });
    }
  };

  // Toggle MSA for comparison
  const toggleComparison = (msa: string) => {
    const newSelected = new Set(selectedForComparison);
    if (newSelected.has(msa)) {
      newSelected.delete(msa);
    } else {
      if (newSelected.size >= 5) {
        // Limit to 5 MSAs for comparison
        return;
      }
      newSelected.add(msa);
    }
    setSelectedForComparison(newSelected);
  };

  // Fetch opportunities for selected MSAs (for comparison)
  useEffect(() => {
    const msasToFetch = Array.from(selectedForComparison).filter(
      msaName => !msaOpportunities[msaName] && !loadingOpportunities.has(msaName)
    );
    
    if (msasToFetch.length === 0) return;
    
    // Fetch all in parallel using the shared function
    msasToFetch.forEach((msaName) => {
      fetchOpportunitiesForMSA(String(msaName));
    });
  }, [selectedForComparison]);

  // Get comparison data for selected MSAs
  const comparisonData = useMemo(() => {
    if (selectedForComparison.size === 0) return null;
    
    const selectedMSAs = data.filter(item => selectedForComparison.has(item.MSA));
    
    // Create radar chart data
    const parameters = [
      { key: "HHI_Score", label: "Market Concentration", isInverse: true },
      { key: "Economic_Growth_Score", label: "Economic Growth", isInverse: false },
      { key: "Loan_Growth_Score", label: "Loan Growth", isInverse: false },
      { key: "Risk_Score", label: "Credit Risk", isInverse: true },
      { key: "Premium_Discount_Score", label: "Premium/Discount", isInverse: false },
      { key: "Pricing_Rationality_Score", label: "Pricing Rationality", isInverse: false },
      { key: "International_CM_Score", label: "International CM", isInverse: false },
    ];

    const radarData = parameters.map(param => {
      const dataPoint: any = { parameter: param.label };
      selectedMSAs.forEach(msa => {
        const scoreValue = (msa as any)[param.key];
        dataPoint[msa.MSA] = scoreToValue(scoreValue, param.isInverse);
      });
      return dataPoint;
    });

    return { radarData, selectedMSAs };
  }, [selectedForComparison, data]);

  // Get opportunities radar data - shows top 3 opportunities for each selected MSA
  // Creates separate radar charts for each MSA
  const opportunitiesRadarData = useMemo(() => {
    if (selectedForComparison.size === 0) return null;
    
    const msaCharts: Array<{
      msaName: string;
      radarData: any[];
      opportunities: OpportunityData[];
    }> = [];
    
    // For opportunities, we'll use simpler metrics that make sense
    const opportunityParameters = [
      { key: "Market Share", label: "Market Share" },
      { key: "Defend $", label: "Defensive Value" },
      { key: "Market Size", label: "Market Size" },
    ];
    
    // Normalize values to 0-3 scale for radar chart
    const normalizeValue = (value: number, min: number, max: number): number => {
      if (max === min) return 1.5;
      return ((value - min) / (max - min)) * 3;
    };
    
    // Process each MSA separately
    selectedForComparison.forEach(msaName => {
      const opportunities = msaOpportunities[msaName] || [];
      if (opportunities.length === 0) return;
      
      // Calculate min/max for each parameter within this MSA's opportunities
      const ranges = opportunityParameters.reduce((acc, param) => {
        const values = opportunities.map(opp => {
          const val = opp[param.key];
          return typeof val === 'string' ? parseFloat(val) : (val || 0);
        });
        acc[param.key] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
        return acc;
      }, {} as Record<string, { min: number; max: number }>);
      
      // Create radar data for this MSA
      const radarData = opportunityParameters.map(param => {
        const dataPoint: any = { parameter: param.label };
        opportunities.forEach(opp => {
          const val = opp[param.key];
          const numVal = typeof val === 'string' ? parseFloat(val) : (val || 0);
          const normalized = normalizeValue(numVal, ranges[param.key].min, ranges[param.key].max);
          dataPoint[opp.Provider] = normalized;
        });
        return dataPoint;
      });
      
      msaCharts.push({ msaName, radarData, opportunities });
    });
    
    return msaCharts.length > 0 ? msaCharts : null;
  }, [selectedForComparison, msaOpportunities]);

  // Export data to CSV
  const exportToCSV = () => {
    const headers = ["Rank", "MSA", "Score", "Category", "Market Size", "Economic Growth", "Loan Growth", "HHI", "Risk", "Pricing"];
    const rows = topMSAs.map((msa, idx) => [
      idx + 1,
      msa.MSA,
      msa.Attractiveness_Score.toFixed(2),
      msa.Attractiveness_Category,
      msa["Market Size"],
      msa.Economic_Growth_Score,
      msa.Loan_Growth_Score,
      msa.HHI_Score,
      msa.Risk_Score,
      msa.Pricing_Rationality
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `msa-explorer-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAttractivenessColor = (category: string) => {
    switch (category) {
      case "Highly Attractive":
        return "bg-green-100 text-green-800 border-green-300";
      case "Attractive":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Neutral":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "Challenging":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3>Filters & Search</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2 space-y-2">
            <Label>Search MSA</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by MSA name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
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
                <SelectItem value="Highly Attractive">Highly Attractive</SelectItem>
                <SelectItem value="Attractive">Attractive</SelectItem>
                <SelectItem value="Neutral">Neutral</SelectItem>
                <SelectItem value="Challenging">Challenging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pricing Filter */}
          <div className="space-y-2">
            <Label>Pricing</Label>
            <Select value={selectedPricing} onValueChange={setSelectedPricing}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Rational">Rational</SelectItem>
                <SelectItem value="Irrational">Irrational</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Growth Filter */}
          <div className="space-y-2">
            <Label>Growth Score</Label>
            <Select value={selectedGrowth} onValueChange={setSelectedGrowth}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Summary */}
        <div className="mt-4 flex items-center gap-2 text-sm">
          {globallyFilteredData.length < data.length && (
            <div className="text-xs bg-blue-50 px-3 py-1 rounded-full border border-blue-200 text-blue-700">
              {globallyFilteredData.length} MSAs match global filters
            </div>
          )}
          <span className="text-muted-foreground">
            Showing {filteredData.length} of {data.length} MSAs
          </span>
          {(searchTerm || selectedAttractiveness !== "all" || 
            selectedPricing !== "all" || selectedGrowth !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedAttractiveness("all");
                setSelectedPricing("all");
                setSelectedGrowth("all");
              }}
              className="text-primary hover:underline text-sm"
            >
              Clear page filters
            </button>
          )}
        </div>
      </Card>

      {/* Comparison Dialog */}
      {comparisonData && selectedForComparison.size > 0 && (
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="mb-1">MSA Comparison ({selectedForComparison.size} selected)</h3>
              <p className="text-sm text-muted-foreground">Compare key metrics and top opportunities across selected MSAs</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSelectedForComparison(new Set());
                setMsaOpportunities({});
              }}
            >
              Clear Selection
            </Button>
          </div>

          <div className="mt-6 flex-1">
              {/* Individual MSA Cards with Radar Charts - Full Width Responsive Grid */}
              <div className={`grid gap-4 items-stretch ${
                selectedForComparison.size === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
                selectedForComparison.size === 2 ? 'grid-cols-1 lg:grid-cols-2' :
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              }`}>
                {comparisonData.selectedMSAs.map((msa, idx) => {
                  // Create radar data for this specific MSA
                  const parameters = [
                    { key: "HHI_Score", label: "Market Concentration", isInverse: true },
                    { key: "Economic_Growth_Score", label: "Economic Growth", isInverse: false },
                    { key: "Loan_Growth_Score", label: "Loan Growth", isInverse: false },
                    { key: "Risk_Score", label: "Credit Risk", isInverse: true },
                    { key: "Premium_Discount_Score", label: "Premium/Discount", isInverse: false },
                    { key: "Pricing_Rationality_Score", label: "Pricing Rationality", isInverse: false },
                    { key: "International_CM_Score", label: "International CM", isInverse: false },
                  ];

                  const msaRadarData = parameters.map(param => {
                    const scoreValue = (msa as any)[param.key];
                    const numericValue = scoreToValue(scoreValue, param.isInverse);
                    
                    // Debug logging for Pricing_Rationality_Score
                    if (param.key === "Pricing_Rationality_Score") {
                      console.log(`MSAExplorer: Pricing_Rationality_Score for ${msa.MSA}:`, {
                        rawValue: scoreValue,
                        normalizedValue: numericValue,
                        type: typeof scoreValue
                      });
                    }
                    
                    return {
                      parameter: param.label,
                      value: numericValue
                    };
                  });

                  const colors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
                  const msaColor = colors[idx % colors.length];

                  return (
                    <div key={msa.MSA} className="bg-white dark:bg-gray-900 rounded-lg border p-4 flex flex-col min-h-[500px]">
                      <h4 className="mb-3 flex items-center gap-2 min-h-[1.75rem]">
                        <MapPin className="h-4 w-4 flex-shrink-0" style={{ color: msaColor }} />
                        <span className="font-semibold text-sm truncate">{msa.MSA}</span>
                      </h4>
                      
                      {/* Radar Chart */}
                      <div className="mb-3 flex-shrink-0">
                        <ResponsiveContainer width="100%" height={240}>
                          <RadarChart data={msaRadarData}>
                            <PolarGrid stroke="currentColor" className="opacity-20" />
                            <PolarAngleAxis 
                              dataKey="parameter" 
                              tick={{ fontSize: 10 }}
                              stroke="currentColor"
                              className="opacity-60"
                            />
                            <PolarRadiusAxis 
                              angle={90} 
                              domain={[0, 3]}
                              tick={{ fontSize: 9 }}
                              stroke="currentColor"
                              className="opacity-40"
                            />
                            <Radar
                              name={msa.MSA}
                              dataKey="value"
                              stroke={msaColor}
                              fill={msaColor}
                              fillOpacity={0.25}
                              strokeWidth={2}
                            />
                            <Tooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Detailed Metrics Table */}
                      <div className="overflow-x-auto flex-1">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-1.5 px-2 text-xs">Metric</th>
                              <th className="text-left py-1.5 px-2 text-xs">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b bg-muted/30">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Attractiveness</td>
                              <td className="py-1.5 px-2 font-semibold">{msa.Attractiveness_Score.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Category</td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[10px] ${getAttractivenessColor(msa.Attractiveness_Category)}`}>
                                  {msa.Attractiveness_Category}
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b bg-muted/30">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Market Size</td>
                              <td className="py-1.5 px-2 whitespace-nowrap">${(msa["Market Size"] / 1000000).toFixed(1)}M</td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Econ Growth</td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[10px] ${getParameterColor("Economic_Growth_Score", msa.Economic_Growth_Score)}`}>
                                  {msa.Economic_Growth_Score}
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b bg-muted/30">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Loan Growth</td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[10px] ${getParameterColor("Loan_Growth_Score", msa.Loan_Growth_Score)}`}>
                                  {msa.Loan_Growth_Score}
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">HHI</td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[10px] ${getParameterColor("HHI_Score", msa.HHI_Score)}`}>
                                  {msa.HHI_Score}
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b bg-muted/30">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Credit Risk</td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[10px] ${getParameterColor("Risk_Score", msa.Risk_Score)}`}>
                                  {msa.Risk_Score}
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Premium/Discount</td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[10px] ${getParameterColor("Premium_Discount_Score", msa.Premium_Discount_Score)}`}>
                                  {msa.Premium_Discount_Score}
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b bg-muted/30">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Pricing</td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[10px] ${getParameterColor("Pricing_Rationality_Score", msa.Pricing_Rationality)}`}>
                                  {msa.Pricing_Rationality}
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b">
                              <td className="py-1.5 px-2 font-medium whitespace-nowrap">Int'l CM</td>
                              <td className="py-1.5 px-2">
                                <Badge variant="outline" className={`text-[10px] ${getParameterColor("International_CM_Score", msa.International_CM_Score)}`}>
                                  {msa.International_CM_Score}
                                </Badge>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
        </Card>
      )}

      {/* MSAs Detailed Table */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="mb-1">
              {showAllRows ? `All ${filteredData.length} MSAs` : "Top 10 MSAs"} by Attractiveness Score
            </h3>
            <p className="text-sm text-muted-foreground">
              Click on any row to see detailed breakdown of all scoring parameters
              {selectedForComparison.size > 0 && ` • ${selectedForComparison.size} selected for comparison`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllRows(!showAllRows)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showAllRows ? "Show Top 10" : `Show All ${filteredData.length}`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 w-12">
                  <span className="sr-only">Select</span>
                </th>
                <th className="text-left py-3 px-3">Rank</th>
                <th className="text-left py-3 px-3">MSA</th>
                <th className="text-left py-3 px-3">Score</th>
                <th className="text-left py-3 px-3">Market Attractiveness</th>
                <th className="text-left py-3 px-3">Market Size</th>
                <th className="text-left py-3 px-3">Market Conc.</th>
                <th className="text-left py-3 px-3">Econ. Growth</th>
                <th className="text-left py-3 px-3">Loan Growth</th>
                <th className="text-left py-3 px-3">Risk</th>
                <th className="text-left py-3 px-3">Risk Migration</th>
                <th className="text-left py-3 px-3">Rel. Risk Mig.</th>
                <th className="text-left py-3 px-3">Premium/Disc.</th>
                <th className="text-left py-3 px-3">Pricing</th>
                <th className="text-left py-3 px-3">Intl. CM</th>
                <th className="text-left py-3 px-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {topMSAs.map((msa, idx) => {
                const isExpanded = expandedRows.has(msa.MSA);
                const isSelected = selectedForComparison.has(msa.MSA);
                
                return (
                  <React.Fragment key={msa.MSA}>
                    <tr 
                      className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                      onClick={() => toggleRowExpansion(msa.MSA)}
                    >
                      <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleComparison(msa.MSA)}
                          disabled={!isSelected && selectedForComparison.size >= 5}
                        />
                      </td>
                      <td className="py-3 px-3">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{msa.MSA}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{msa.Attractiveness_Score.toFixed(2)}</span>
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge className={getAttractivenessColor(msa.Attractiveness_Category)}>
                          {msa.Attractiveness_Category}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        ${(msa["Market Size"] / 1000000).toFixed(1)}M
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${getParameterColor("HHI_Score", msa.HHI_Score)}`}>{msa.HHI_Score}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${getParameterColor("Economic_Growth_Score", msa.Economic_Growth_Score)}`}>{msa.Economic_Growth_Score}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${getParameterColor("Loan_Growth_Score", msa.Loan_Growth_Score)}`}>{msa.Loan_Growth_Score}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${getParameterColor("Risk_Score", msa.Risk_Score)}`}>{msa.Risk_Score}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${getParameterColor("Risk_Migration_Score", msa.Risk_Migration_Score)}`}>{msa.Risk_Migration_Score}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${getParameterColor("Relative_Risk_Migration_Score", msa.Relative_Risk_Migration_Score)}`}>{msa.Relative_Risk_Migration_Score}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${getParameterColor("Premium_Discount_Score", msa.Premium_Discount_Score)}`}>{msa.Premium_Discount_Score}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getParameterColor("Pricing_Rationality_Score", msa.Pricing_Rationality)}`}
                        >
                          {msa.Pricing_Rationality}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${getParameterColor("International_CM_Score", msa.International_CM_Score)}`}>{msa.International_CM_Score}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                    </tr>
                    
                    {/* Expanded Row Details */}
                    {isExpanded && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={16} className="p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <Card className="p-4 bg-card">
                                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4" />
                                  Market Metrics
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Market Size:</span>
                                    <Badge variant="outline">{msa.Market_Size_Score}</Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Market Concentration:</span>
                                    <Badge variant="outline">{msa.HHI_Score}</Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">International CM:</span>
                                    <Badge variant="outline">{msa.International_CM_Score}</Badge>
                                  </div>
                                </div>
                              </Card>

                              <Card className="p-4 bg-card">
                                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4" />
                                  Growth & Risk
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Economic Growth:</span>
                                    <Badge variant="outline">{msa.Economic_Growth_Score}</Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Loan Growth:</span>
                                    <Badge variant="outline">{msa.Loan_Growth_Score}</Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Credit Risk:</span>
                                    <Badge variant="outline">{msa.Risk_Score}</Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Risk Migration:</span>
                                    <Badge variant="outline">{msa.Risk_Migration_Score}</Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Relative Risk Migration:</span>
                                    <Badge variant="outline">{msa.Relative_Risk_Migration_Score}</Badge>
                                  </div>
                                </div>
                              </Card>

                              <Card className="p-4 bg-card">
                                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <Info className="h-4 w-4" />
                                  Pricing & Other
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Premium/Discount:</span>
                                    <Badge variant="outline">{msa.Premium_Discount_Score}</Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Pricing Rationality:</span>
                                    <Badge variant="outline">{msa.Pricing_Rationality_Score}</Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Revenue per Company:</span>
                                    <Badge variant="outline">{msa.Revenue_per_Company_Score}</Badge>
                                  </div>
                                  {msa.Pricing_Rationality_Explanation && (
                                    <div className="pt-2 border-t">
                                      <p className="text-xs text-muted-foreground italic">
                                        {msa.Pricing_Rationality_Explanation}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            </div>
                            
                            {/* All Opportunities for this MSA */}
                            {msaOpportunities[msa.MSA] && msaOpportunities[msa.MSA].length > 0 && (
                              <Card className="p-4 bg-card">
                                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                  <Target className="h-4 w-4" />
                                  Competitive Landscape ({msaOpportunities[msa.MSA].length})
                                </h4>
                                <ScrollArea className="h-96">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="sticky top-0 bg-card z-10">
                                        <tr className="border-b">
                                          <th className="text-left py-2 px-2">#</th>
                                          <th className="text-left py-2 px-2">Provider</th>
                                          <th className="text-right py-2 px-2">Market Share</th>
                                          <th className="text-right py-2 px-2">Market Share at Risk</th>
                                          <th className="text-right py-2 px-2">Market Size</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {msaOpportunities[msa.MSA].map((opp, oppIdx) => {
                                          const marketShare = parseFloat(String(opp["Market Share"] || 0));
                                          const marketSize = parseFloat(String(opp["Market Size"] || 0));
                                          const defendDollars = parseFloat(String(opp["Defend $"] || 0));
                                          const providerMarketShareDollars = marketShare * marketSize;
                                          
                                          const percentageAtRisk = providerMarketShareDollars === 0 ? 0 : (defendDollars / providerMarketShareDollars) * 100;
                                          
                                          return (
                                          <tr key={`${opp.Provider}-${oppIdx}`} className="border-b hover:bg-muted/50">
                                            <td className="py-2 px-2">{oppIdx + 1}</td>
                                            <td className="py-2 px-2 font-medium">{opp.Provider}</td>
                                            <td className="py-2 px-2 text-right">
                                              {(marketShare * 100).toFixed(1)}%
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                              {(() => {
                                                if (percentageAtRisk < 5) return "<5%";
                                                if (percentageAtRisk > 25) return ">25%";
                                                return `${percentageAtRisk.toFixed(1)}%`;
                                              })()}
                                            </td>
                                            <td className="py-2 px-2 text-right">
                                              ${(marketSize / 1000000).toFixed(1)}M
                                            </td>
                                          </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </ScrollArea>
                              </Card>
                            )}
                            
                            {/* Loading state for opportunities */}
                            {loadingOpportunities.has(msa.MSA) && (
                              <Card className="p-4 bg-card">
                                <div className="flex items-center justify-center py-4 text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  <span className="text-sm">Loading opportunities...</span>
                                </div>
                              </Card>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {!showAllRows && filteredData.length > 10 && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              onClick={() => setShowAllRows(true)}
            >
              Show All {filteredData.length} MSAs
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
