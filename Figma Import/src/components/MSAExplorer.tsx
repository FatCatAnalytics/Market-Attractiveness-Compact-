import React, { useState, useMemo, useEffect } from "react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ScatterChart, Scatter, ZAxis, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { Search, ChevronDown, ChevronUp, Download, Eye, Filter, TrendingUp, MapPin, Info, BarChart3, Maximize2, Target, Loader2, DollarSign, Building2, Users } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { calculateDefensiveValue, calculateBucketModeScore, calculateAttractivenessScore, getCategoriesByQuartiles, DEFAULT_BUCKET_ASSIGNMENTS } from "../utils/scoreCalculation";
import { applyGlobalFilters } from "../utils/applyGlobalFilters";
import { fetchFilterBuckets, fetchMSADetails, fetchAllOpportunitiesRaw, fetchMSAAttractivenessWithDeposits } from "../utils/csvDataHooks";
import { USAMap } from "./USAMap";
import { MSADetailView } from "./MSADetailView";
import { MSAEconomicProfile, MSAEconomicProfileCompact } from "./MSAEconomicProfile";
import { OpportunitiesTable } from "./OpportunityTable";
import { MSACompetitiveTable } from "./MSACompetitiveTable";
import { SelectedProvidersPanel } from "./SelectedProvidersPanel";
import { useMSAEconomics, fetchMSAEconomics } from "../utils/csvDataHooks";
import { MSAEconomicsData } from "../utils/csvDataService";

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
  Weighted_Average_Score?: number;
}

interface MSAExplorerProps {
  data: MSAData[];
  weights: any;
  globalFilters?: any;
  bucketAssignments?: any;
  bucketWeights?: { high: number; medium: number };
  selectedProviders?: Set<string>;
  onToggleProviderSelection?: (provider: string) => void;
  onClearProviderSelections?: () => void;
  onNavigateToCompetitorAnalysis?: () => void;
  onMSASelectionChange?: (msas: Set<string>) => void;
}





export function MSAExplorer({ data, weights, globalFilters, bucketAssignments, bucketWeights = { high: 60, medium: 40 }, selectedProviders, onToggleProviderSelection, onClearProviderSelections, onNavigateToCompetitorAnalysis, onMSASelectionChange }: MSAExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAttractiveness, setSelectedAttractiveness] = useState("all");
  const [selectedPricing, setSelectedPricing] = useState("all");
  const [selectedGrowth, setSelectedGrowth] = useState("all");
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAllRows, setShowAllRows] = useState(false);
  const [msaOpportunities, setMsaOpportunities] = useState<Record<string, OpportunityData[]>>({});
  const [loadingOpportunities, setLoadingOpportunities] = useState<Set<string>>(new Set());
  const [allOpportunities, setAllOpportunities] = useState<OpportunityData[]>([]);
  const [filterBuckets, setFilterBuckets] = useState<{
    marketSize?: { range: { min: number; max: number } };
    revenuePerCompany?: { range: { min: number; max: number } };
  }>({});
  const [msaEconomicsMap, setMsaEconomicsMap] = useState<Record<string, MSAEconomicsData>>({});
  const [msaAttractivenessData, setMsaAttractivenessData] = useState<Record<string, any[]>>({});

  // Get the selected MSA name when exactly one MSA is selected
  const selectedMSAName = selectedForComparison.size === 1 
    ? Array.from(selectedForComparison)[0] 
    : null;
  
  // Fetch attractiveness data (including Deposits) for selected MSAs
  useEffect(() => {
    const fetchAttractivenessData = async () => {
      if (selectedForComparison.size === 0) {
        setMsaAttractivenessData({});
        return;
      }
      
      const selectedMSAs = Array.from(selectedForComparison);
      const newAttractivenessData: Record<string, any[]> = {};
      
      try {
        // Fetch attractiveness data for all selected MSAs
        await Promise.all(
          selectedMSAs.map(async (msaName) => {
            try {
              const attractivenessData = await fetchMSAAttractivenessWithDeposits(msaName);
              newAttractivenessData[msaName] = attractivenessData;
            } catch (error) {
              console.error(`Error fetching attractiveness data for ${msaName}:`, error);
              // Fallback to using data prop
              const allDataForMSA = data.filter(m => m.MSA === msaName);
              newAttractivenessData[msaName] = allDataForMSA;
            }
          })
        );
        
        setMsaAttractivenessData(newAttractivenessData);
      } catch (error) {
        console.error("Error fetching attractiveness data:", error);
      }
    };
    
    fetchAttractivenessData();
  }, [selectedForComparison, data]);
  
  // Fetch MSA economics data when a single MSA is selected
  const { economics: msaEconomics } = useMSAEconomics(selectedMSAName);

  // Fetch economics data for all selected MSAs (for comparison view)
  useEffect(() => {
    const fetchAllEconomics = async () => {
      const msaNames = Array.from(selectedForComparison);
      const newEconomicsMap: Record<string, MSAEconomicsData> = {};
      
      await Promise.all(
        msaNames.map(async (msaName) => {
          const economics = await fetchMSAEconomics(msaName);
          if (economics) {
            newEconomicsMap[msaName] = economics;
          }
        })
      );
      
      setMsaEconomicsMap(newEconomicsMap);
    };

    if (selectedForComparison.size > 0) {
      fetchAllEconomics();
    } else {
      setMsaEconomicsMap({});
    }
  }, [selectedForComparison]);

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

  // Fetch all national opportunities for MSAs Penetrated counts
  useEffect(() => {
    const fetchAllOpps = async () => {
      try {
        console.log("MSAExplorer: Fetching all national opportunities...");
        const opps = await fetchAllOpportunitiesRaw();
        console.log(`MSAExplorer: Received ${opps.length} national opportunities`);
        setAllOpportunities(opps);
      } catch (error) {
        console.error("Error fetching all opportunities:", error);
        setAllOpportunities([]);
      }
    };

    fetchAllOpps();
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
    if (["Economic_Growth_Score", "Loan_Growth_Score", "International_CM_Score", "Market_Size_Score", "Revenue_per_Company_Score"].includes(parameterType)) {
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

  // Notify parent component when MSA selection changes
  useEffect(() => {
    if (onMSASelectionChange) {
      onMSASelectionChange(selectedForComparison);
    }
  }, [selectedForComparison, onMSASelectionChange]);

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
    // Sort data by attractiveness score for export
    const sortedData = [...filteredData].sort((a, b) => b.Attractiveness_Score - a.Attractiveness_Score);

    const headers = ["Rank", "MSA", "Score", "Category", "Market Size", "Economic Growth", "Loan Growth", "HHI", "Risk", "Pricing"];
    const rows = sortedData.map((msa, idx) => [
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
      {/* Interactive Map */}
      <USAMap 
        mapData={globallyFilteredData} 
        globalFilters={globalFilters}
        bucketAssignments={bucketAssignments}
        selectedMSAs={selectedForComparison}
        onToggleSelection={toggleComparison}
      />

      {/* MSA Name Heading - shown when a single MSA is selected */}
      {selectedForComparison.size === 1 && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">{selectedMSAName}</h3>
            <p className="text-muted-foreground">Market Analysis & Competitive Landscape</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setSelectedForComparison(new Set())}
          >
            Back to All MSAs
          </Button>
        </div>
      )}

      {/* Market Size & Company Metrics - shown when a single MSA is selected */}
      {selectedForComparison.size === 1 && (() => {
        // Format number helper
        const formatMarketSize = (num: number): string => {
          if (num >= 1_000_000_000) {
            return `$${(num / 1_000_000_000).toFixed(1)}B`;
          }
          if (num >= 1_000_000) {
            return `$${(num / 1_000_000).toFixed(1)}M`;
          }
          if (num >= 1_000) {
            return `$${(num / 1_000).toFixed(1)}K`;
          }
          return `$${num.toFixed(0)}`;
        };

        // Aggregate data across all selected MSAs
        const selectedMSAs = Array.from(selectedForComparison);
        let totalCashManagementMarketSize = 0;
        let totalDepositsMarketSize = 0;
        let totalNumberOfCompanies = 0; // Sum company counts from each MSA
        
        selectedMSAs.forEach(msaName => {
          const attractivenessDataForMSA = msaAttractivenessData[msaName] || [];
          
          // Get market size by product from attractiveness data
          const cashManagementData = attractivenessDataForMSA.find(m => {
            const product = m.Product?.toLowerCase() || "";
            return product.includes("cash") || product.includes("credit") || 
                   (product !== "deposits" && m.Product !== "Deposits");
          });
          
          const depositsData = attractivenessDataForMSA.find(m => 
            m.Product === "Deposits" || m.Product?.toLowerCase() === "deposits"
          );
          
          if (cashManagementData) {
            totalCashManagementMarketSize += parseFloat(String(cashManagementData["Market Size"] || 0));
            
            // Get Number of Companies from attractiveness data (same for both Credit & Cash Management and Deposits)
            // Only count once per MSA, not per product
            const numCompanies = cashManagementData["Number of Companies"];
            if (numCompanies !== undefined && numCompanies !== null) {
              const companyCount = typeof numCompanies === 'number' 
                ? numCompanies 
                : parseFloat(String(numCompanies));
              if (!isNaN(companyCount) && companyCount > 0) {
                totalNumberOfCompanies += companyCount;
              }
            }
          }
          
          if (depositsData) {
            totalDepositsMarketSize += parseFloat(String(depositsData["Market Size"] || 0));
          }
        });
        
        const totalMarketSize = totalCashManagementMarketSize + totalDepositsMarketSize;
        const numberOfCompanies = totalNumberOfCompanies;
        const averageRevenuePerCompany = numberOfCompanies > 0 ? totalMarketSize / numberOfCompanies : 0;

        return (
          <Card className="p-4 bg-gradient-to-br from-slate-50 to-white border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">
                  Market Overview
                </h3>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Credit & Cash Management Market Size */}
              <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Credit & Cash Management</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                  <span className="text-lg font-bold text-slate-800">
                    {formatMarketSize(totalCashManagementMarketSize)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Market Size</p>
              </div>

              {/* Deposits Market Size */}
              <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Deposits</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                  <span className="text-lg font-bold text-slate-800">
                    {formatMarketSize(totalDepositsMarketSize)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Market Size</p>
              </div>

              {/* Number of Companies */}
              <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Number of Companies</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span className="text-lg font-bold text-slate-800">
                    {numberOfCompanies}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Companies</p>
              </div>

              {/* Average Revenue per Company */}
              <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Avg Revenue/Company</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-lg font-bold text-slate-800">
                    {formatMarketSize(averageRevenuePerCompany)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Total ÷ companies</p>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* MSA Economic Profile - shown when a single MSA is selected */}
      {selectedForComparison.size === 1 && msaEconomics && selectedMSAName && (
        <MSAEconomicProfile 
          economics={msaEconomics} 
          msaName={selectedMSAName} 
        />
      )}

      {/* Detail View (Single Selection) */}
      {selectedForComparison.size === 1 && (() => {
        const msaName = Array.from(selectedForComparison)[0];
        const msaData = data.find(m => m.MSA === msaName);
        const opportunities = msaOpportunities[msaName] || [];
        
        if (!msaData) return null;
        
        return (
          <div className="space-y-4">
            {loadingOpportunities.has(msaName) ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MSADetailView 
                msaData={msaData} 
                opportunities={opportunities} 
                allOpportunities={allOpportunities}
                selectedProviders={selectedProviders}
                onToggleProviderSelection={onToggleProviderSelection}
              />
            )}
          </div>
        );
      })()}

      {/* Comparison View (Multiple Selection) */}
      {comparisonData && selectedForComparison.size > 1 && (
        <>
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
                selectedForComparison.size === 2 ? 'grid-cols-1 lg:grid-cols-2' :
                selectedForComparison.size === 3 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' :
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
                    return {
                      parameter: param.label,
                      value: numericValue
                    };
                  });

                  const colors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
                  const msaColor = colors[idx % colors.length];
                  
                  // Get opportunities for this MSA
                  const opportunities = msaOpportunities[msa.MSA] || [];

                  // Get Market Overview data for this specific MSA
                  const attractivenessDataForMSA = msaAttractivenessData[msa.MSA] || [];
                  const msaOpportunitiesForCard = msaOpportunities[msa.MSA] || [];
                  
                  // Get market size by product from attractiveness data
                  const cashManagementData = attractivenessDataForMSA.find(m => {
                    const product = m.Product?.toLowerCase() || "";
                    return product.includes("cash") || product.includes("credit") || 
                           (product !== "deposits" && m.Product !== "Deposits");
                  });
                  
                  const depositsData = attractivenessDataForMSA.find(m => 
                    m.Product === "Deposits" || m.Product?.toLowerCase() === "deposits"
                  );
                  
                  const cashManagementMarketSize = cashManagementData 
                    ? parseFloat(String(cashManagementData["Market Size"] || 0)) 
                    : 0;
                  const depositsMarketSize = depositsData 
                    ? parseFloat(String(depositsData["Market Size"] || 0)) 
                    : 0;
                  const totalMarketSize = cashManagementMarketSize + depositsMarketSize;
                  
                  // Get number of companies from attractiveness data (same for both Credit & Cash Management and Deposits)
                  let numberOfCompanies = 0;
                  if (cashManagementData && cashManagementData["Number of Companies"] !== undefined) {
                    const numCompanies = cashManagementData["Number of Companies"];
                    numberOfCompanies = typeof numCompanies === 'number' 
                      ? numCompanies 
                      : parseFloat(String(numCompanies));
                    if (isNaN(numberOfCompanies)) {
                      numberOfCompanies = 0;
                    }
                  }
                  
                  // Calculate average revenue per company
                  const averageRevenuePerCompany = numberOfCompanies > 0 ? totalMarketSize / numberOfCompanies : 0;
                  
                  // Format number helper
                  const formatMarketSize = (num: number): string => {
                    if (num >= 1_000_000_000) {
                      return `$${(num / 1_000_000_000).toFixed(1)}B`;
                    }
                    if (num >= 1_000_000) {
                      return `$${(num / 1_000_000).toFixed(1)}M`;
                    }
                    if (num >= 1_000) {
                      return `$${(num / 1_000).toFixed(1)}K`;
                    }
                    return `$${num.toFixed(0)}`;
                  };

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
                        <table className="w-full text-xs mb-4">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-1.5 px-2 text-xs">Metric</th>
                              <th className="text-left py-1.5 px-2 text-xs">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b last:border-0">
                              <td className="py-1 px-2 text-muted-foreground">Growth</td>
                              <td className="py-1 px-2 font-medium">{msa.Economic_Growth_Score}</td>
                            </tr>
                            <tr className="border-b last:border-0">
                              <td className="py-1 px-2 text-muted-foreground">Risk</td>
                              <td className="py-1 px-2 font-medium">{msa.Risk_Score}</td>
                            </tr>
                            <tr className="border-b last:border-0">
                              <td className="py-1 px-2 text-muted-foreground">Pricing</td>
                              <td className="py-1 px-2 font-medium">{msa.Pricing_Rationality}</td>
                            </tr>
                          </tbody>
                        </table>
                        
                        {/* Market Overview for this MSA */}
                        <div className="mb-3 bg-slate-50 rounded-lg p-2 border border-slate-200">
                          <div className="text-[10px] font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" />
                            Market Overview
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Credit & Cash Management */}
                            <div className="flex items-center justify-between bg-white rounded px-1.5 py-1 border border-slate-100">
                              <span className="text-[10px] text-slate-500">Credit & Cash Management</span>
                              <span className="text-[10px] font-semibold">{formatMarketSize(cashManagementMarketSize)}</span>
                            </div>
                            {/* Deposits */}
                            <div className="flex items-center justify-between bg-white rounded px-1.5 py-1 border border-slate-100">
                              <span className="text-[10px] text-slate-500">Deposits</span>
                              <span className="text-[10px] font-semibold">{formatMarketSize(depositsMarketSize)}</span>
                            </div>
                            {/* Number of Companies */}
                            <div className="flex items-center justify-between bg-white rounded px-1.5 py-1 border border-slate-100">
                              <span className="text-[10px] text-slate-500">Companies</span>
                              <span className="text-[10px] font-semibold">{numberOfCompanies}</span>
                            </div>
                            {/* Avg Revenue/Company */}
                            <div className="flex items-center justify-between bg-white rounded px-1.5 py-1 border border-slate-100">
                              <span className="text-[10px] text-slate-500">Avg Rev/Co</span>
                              <span className="text-[10px] font-semibold">{formatMarketSize(averageRevenuePerCompany)}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Economic Indicators (Compact) */}
                        {msaEconomicsMap[msa.MSA] && (
                          <div className="mt-3">
                            <MSAEconomicProfileCompact economics={msaEconomicsMap[msa.MSA]} />
                          </div>
                        )}
                        
                        {/* Competitive Landscape Table */}
                        <div className="mt-4 pt-4 border-t">
                             <h5 className="text-xs font-semibold mb-2 text-muted-foreground">Competitive Landscape</h5>
                             <div className="max-h-[400px] overflow-y-auto">
                               <MSACompetitiveTable 
                                 opportunities={opportunities} 
                                 allOpportunities={allOpportunities}
                                 selectedProviders={selectedProviders}
                                 onToggleProviderSelection={onToggleProviderSelection}
                               />
                             </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
        </Card>
        </>
      )}

      {/* Filters & List Section (Only when no selection) */}
      {selectedForComparison.size === 0 && (
        <>
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

          {/* Top 10 MSAs by Attractiveness Score */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">
                  {showAllRows ? `All ${filteredData.length} MSAs` : "Top 10 MSAs"} by Attractiveness Score
                </h3>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllRows(!showAllRows)}
                  className="text-xs"
                >
                  <Eye className="h-3 w-3 mr-2" />
                  {showAllRows ? "Show Top 10" : `Show All ${filteredData.length}`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  className="text-xs"
                >
                  <Download className="h-3 w-3 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-xs font-medium">Rank</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">MSA</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Score</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Market Attractiveness</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Market Size</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Market Conc.</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Econ. Growth</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Loan Growth</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Risk</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Risk Migration</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Rel. Risk Mig.</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Premium/Disc.</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Pricing</th>
                    <th className="text-left py-2 px-2 text-xs font-medium">Intl. CM</th>
                  </tr>
                </thead>
                <tbody>
                  {topMSAs.map((msa, idx) => {
                    const isSelected = selectedForComparison.has(msa.MSA);
                    const canSelect = isSelected || selectedForComparison.size < 5;
                    
                    return (
                      <tr 
                        key={msa.MSA}
                        onClick={() => {
                          if (canSelect) {
                            toggleComparison(msa.MSA);
                          }
                        }}
                        className={`border-b transition-colors ${
                          canSelect ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed opacity-50'
                        } ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-500' : ''}`}
                      >
                        <td className="py-2 px-2">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-xs">{msa.MSA}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-xs">{msa.Attractiveness_Score.toFixed(2)}</span>
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <Badge className={`text-[10px] ${getAttractivenessColor(msa.Attractiveness_Category)}`}>
                            {msa.Attractiveness_Category}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-xs">
                          ${(msa["Market Size"] / 1000000).toFixed(1)}M
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[10px] ${getParameterColor("HHI_Score", msa.HHI_Score)}`}>{msa.HHI_Score}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[10px] ${getParameterColor("Economic_Growth_Score", msa.Economic_Growth_Score)}`}>{msa.Economic_Growth_Score}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[10px] ${getParameterColor("Loan_Growth_Score", msa.Loan_Growth_Score)}`}>{msa.Loan_Growth_Score}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[10px] ${getParameterColor("Risk_Score", msa.Risk_Score)}`}>{msa.Risk_Score}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[10px] ${getParameterColor("Risk_Migration_Score", msa.Risk_Migration_Score)}`}>{msa.Risk_Migration_Score}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[10px] ${getParameterColor("Relative_Risk_Migration_Score", msa.Relative_Risk_Migration_Score)}`}>{msa.Relative_Risk_Migration_Score}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[10px] ${getParameterColor("Premium_Discount_Score", msa.Premium_Discount_Score)}`}>{msa.Premium_Discount_Score}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] ${getParameterColor("Pricing_Rationality_Score", msa.Pricing_Rationality)}`}
                          >
                            {msa.Pricing_Rationality}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[10px] ${getParameterColor("International_CM_Score", msa.International_CM_Score)}`}>{msa.International_CM_Score}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          
          {/* Competitive Landscape Table (National Level) */}
          <OpportunitiesTable 
            globalFilters={globalFilters}
            bucketAssignments={bucketAssignments}
            mapData={data}
            selectedProviders={selectedProviders}
            onToggleProviderSelection={onToggleProviderSelection}
          />
        </>
      )}

      {/* Selected Providers Panel - Persistent Floating Panel */}
      {selectedProviders && onToggleProviderSelection && onClearProviderSelections && onNavigateToCompetitorAnalysis && (
        <SelectedProvidersPanel
          selectedProviders={selectedProviders}
          onClearSelections={onClearProviderSelections}
          onRemoveProvider={onToggleProviderSelection}
          onNavigateToAnalysis={onNavigateToCompetitorAnalysis}
        />
      )}
    </div>
  );
}