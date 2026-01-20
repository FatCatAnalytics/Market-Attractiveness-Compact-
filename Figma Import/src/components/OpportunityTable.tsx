import React, { useState, useEffect, useMemo } from "react";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { Loader2 } from "lucide-react";
import { fetchAllOpportunitiesRaw, fetchFilterBuckets } from "../utils/csvDataHooks";
import { applyGlobalFilters } from "../utils/applyGlobalFilters";
import { getRegionForMSASync } from "../utils/stateToRegionMapping";
import { BucketAssignment } from "../utils/scoreCalculation";
import { GlobalFilters } from "../types";

interface OpportunityData {
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
  Provider_Opportunity_Rank: number;
  Overall_Opportunity_Rank: number;
  Weighted_Average_Score?: number;
  Exclusion?: boolean;
  Included_In_Ranking?: boolean;
}

interface OpportunitiesTableProps {
  globalFilters: GlobalFilters;
  bucketAssignments: BucketAssignment[];
  mapData?: Array<{ MSA: string; LAT?: number; LON?: number; "Market Size"?: number }>;
  selectedProviders?: Set<string>;
  onToggleProviderSelection?: (provider: string) => void;
}

export function OpportunitiesTable({ globalFilters, bucketAssignments, mapData = [], selectedProviders, onToggleProviderSelection }: OpportunitiesTableProps) {
  const [opportunities, setOpportunities] = useState<OpportunityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompetitiveLandscape, setShowCompetitiveLandscape] = useState(true); // Visible by default
  const [showOnlyIncludedInRanking, setShowOnlyIncludedInRanking] = useState(false); // When true, show only Included_In_Ranking === true
  const [showAllRows, setShowAllRows] = useState(false); // When false, show only first 20 rows
  const [filterBuckets, setFilterBuckets] = useState<{
    marketSize?: { range: { min: number; max: number } };
    revenuePerCompany?: { range: { min: number; max: number } };
  }>({});

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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchAllOpportunitiesRaw();
        setOpportunities(data);
      } catch (error) {
        console.error("Error fetching opportunities:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get filtered MSAs from mapData (if provided) to determine which MSAs pass global filters
  const filteredMSAs = useMemo(() => {
    if (!mapData.length) {
      // If no mapData provided, use all MSAs from opportunities
      return new Set(opportunities.map(opp => opp.MSA));
    }
    
    const filtered = applyGlobalFilters(
      mapData,
      globalFilters,
      bucketAssignments,
      filterBuckets
    );
    
    return new Set(filtered.map(item => item.MSA));
  }, [mapData, opportunities, globalFilters, bucketAssignments, filterBuckets]);

  // Reset showAllRows when filters change
  useEffect(() => {
    setShowAllRows(false);
  }, [globalFilters, showOnlyIncludedInRanking, mapData]);

  // Filter opportunities based on global filters
  const filteredOpportunities = useMemo(() => {
    if (!opportunities.length) return [];
    
    return opportunities.filter(opp => {
      // Check if MSA passes global filters
      if (!filteredMSAs.has(opp.MSA)) {
        return false;
      }
      
      // Filter by Included_In_Ranking checkbox
      // When checked, show only opportunities where Included_In_Ranking === true
      // When unchecked, show all opportunities
      if (showOnlyIncludedInRanking && opp.Included_In_Ranking !== true) {
        return false;
      }
      
      // Check market size filter
      let matchesMarketSize = true;
      if (filterBuckets?.marketSize?.range && globalFilters.marketSizeRange[0] !== 0 && globalFilters.marketSizeRange[1] !== 0) {
        const marketSize = parseFloat(String(opp["Market Size"] || 0));
        const isFullRange = globalFilters.marketSizeRange[0] === filterBuckets.marketSize.range.min && 
                           globalFilters.marketSizeRange[1] === filterBuckets.marketSize.range.max;
        if (!isFullRange) {
          matchesMarketSize = marketSize >= globalFilters.marketSizeRange[0] && 
                             marketSize <= globalFilters.marketSizeRange[1];
        }
      }
      
      // Check region filter
      let matchesRegion = true;
      if (globalFilters.selectedRegions.length > 0) {
        // Use opportunity's LAT/LON if available, otherwise try to find from mapData
        let lat = opp.LAT;
        let lon = opp.LON;
        if (!lat || !lon) {
          const msaData = mapData.find(item => item.MSA === opp.MSA);
          if (msaData) {
            lat = msaData.LAT;
            lon = msaData.LON;
          }
        }
        const msaRegion = getRegionForMSASync(opp.MSA, lat, lon);
        matchesRegion = globalFilters.selectedRegions.includes(msaRegion);
      }
      
      return matchesMarketSize && matchesRegion;
    });
  }, [opportunities, filteredMSAs, globalFilters, bucketAssignments, filterBuckets, mapData, showOnlyIncludedInRanking]);

  // Aggregate opportunities by provider
  const providerAggregates = useMemo(() => {
    if (!filteredOpportunities.length) return [];

    // Group by provider
    const providerMap = new Map<string, {
      provider: string;
      opportunities: OpportunityData[];
      totalMarketShareDollars: number;
      totalDefendDollars: number;
      topMSA: { name: string; marketShare: number };
      satisfactionScores: number[];
      msaSet: Set<string>; // Track unique MSAs
    }>();

    filteredOpportunities.forEach(opp => {
      const provider = opp.Provider;
      if (!provider) return;

      const marketShare = parseFloat(String(opp["Market Share"] || 0));
      const marketSize = parseFloat(String(opp["Market Size"] || 0));
      const defendDollars = parseFloat(String(opp["Defend $"] || 0));
      
      // Normalize market share if it's a decimal
      const normalizedMarketShare = marketShare < 1 && marketShare > 0 ? marketShare * 100 : marketShare;
      const marketShareDollars = (normalizedMarketShare / 100) * marketSize;

      if (!providerMap.has(provider)) {
        providerMap.set(provider, {
          provider,
          opportunities: [],
          totalMarketShareDollars: 0,
          totalDefendDollars: 0,
          topMSA: { name: opp.MSA, marketShare: normalizedMarketShare },
          satisfactionScores: [],
          msaSet: new Set<string>()
        });
      }

      const aggregate = providerMap.get(provider)!;
      aggregate.opportunities.push(opp);
      aggregate.totalMarketShareDollars += marketShareDollars;
      aggregate.totalDefendDollars += defendDollars;
      aggregate.msaSet.add(opp.MSA); // Track unique MSAs

      // Track top MSA by market share
      if (normalizedMarketShare > aggregate.topMSA.marketShare) {
        aggregate.topMSA = { name: opp.MSA, marketShare: normalizedMarketShare };
      }

      // Collect satisfaction scores
      let score = opp.Weighted_Average_Score;
      if (score === undefined || score === null) {
        // Try other potential keys that might come from the API/CSV
        score = (opp as any)["Weighted Average Score"] || (opp as any)["weighted_average_score"];
      }

      if (score !== null && score !== undefined) {
        const numScore = Number(score);
        if (!isNaN(numScore)) {
          aggregate.satisfactionScores.push(numScore);
        }
      }
    });

    // Calculate total national market size for percentage calculation
    const msaMarketSizeMap = new Map<string, number>();
    filteredOpportunities.forEach(opp => {
      const msa = opp.MSA;
      const marketSize = parseFloat(String(opp["Market Size"] || 0));
      msaMarketSizeMap.set(msa, Math.max(msaMarketSizeMap.get(msa) || 0, marketSize));
    });
    const totalNationalMarketSize = Array.from(msaMarketSizeMap.values()).reduce((sum, size) => sum + size, 0);

    // Convert to array and calculate metrics
    return Array.from(providerMap.values()).map(agg => {
      const overallShareSize = totalNationalMarketSize > 0
        ? (agg.totalMarketShareDollars / totalNationalMarketSize) * 100
        : 0;

      const marketShareAtRisk = agg.totalMarketShareDollars > 0
        ? (agg.totalDefendDollars / agg.totalMarketShareDollars) * 100
        : 0;

      const customerSatisfactionScore = agg.satisfactionScores.length > 0
        ? agg.satisfactionScores.reduce((sum, score) => sum + score, 0) / agg.satisfactionScores.length
        : null;

      return {
        provider: agg.provider,
        overallShareSize,
        topMSA: agg.topMSA.name,
        topMSAMarketShare: agg.topMSA.marketShare,
        msasPenetrated: agg.msaSet.size,
        marketShareAtRisk,
        customerSatisfactionScore
      };
    }).sort((a, b) => b.overallShareSize - a.overallShareSize); // Sort by overall share size descending
  }, [filteredOpportunities]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Competitive Landscape</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCompetitiveLandscape(!showCompetitiveLandscape)}
              className="h-8 w-8 p-0"
            >
              {showCompetitiveLandscape ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {showCompetitiveLandscape && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-included-in-ranking"
                checked={showOnlyIncludedInRanking}
                onCheckedChange={(checked) => setShowOnlyIncludedInRanking(checked === true)}
              />
              <Label htmlFor="show-included-in-ranking" className="text-sm cursor-pointer">
                Show only Included in Ranking
              </Label>
            </div>
          )}
        </div>
        {showCompetitiveLandscape && (
          <p className="text-sm text-muted-foreground mt-1">
            All opportunities filtered by current global filters
          </p>
        )}
      </div>

      {showCompetitiveLandscape && (
        <>
          {providerAggregates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No opportunities match the current filters.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="w-full table-auto">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] px-2 text-xs">Provider</TableHead>
                    <TableHead className="text-right min-w-[90px] px-2 text-xs">Overall Share Size (%)</TableHead>
                    <TableHead className="text-right min-w-[90px] px-2 text-xs">MSAs Penetrated</TableHead>
                    <TableHead className="text-right min-w-[120px] px-2 text-xs">Market Share at Risk (%)</TableHead>
                    <TableHead className="text-right min-w-[130px] px-2 text-xs">Customer Satisfaction Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(showAllRows ? providerAggregates : providerAggregates.slice(0, 20)).map((agg, idx) => {
                    const riskDisplay = agg.marketShareAtRisk < 5 
                      ? "<5%" 
                      : agg.marketShareAtRisk > 25 
                        ? ">25%" 
                        : `${agg.marketShareAtRisk.toFixed(1)}%`;
                    
                    const isSelected = selectedProviders?.has(agg.provider) || false;

                    return (
                      <TableRow 
                        key={agg.provider}
                        onClick={() => onToggleProviderSelection?.(agg.provider)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-l-blue-500 font-semibold' 
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <TableCell className="font-medium px-2 text-xs">
                          {agg.provider}
                        </TableCell>
                        <TableCell className="text-right px-2 text-xs">
                          {agg.overallShareSize.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right px-2 text-xs">
                          {agg.msasPenetrated}
                        </TableCell>
                        <TableCell className="text-right px-2 text-xs">
                          {riskDisplay}
                        </TableCell>
                        <TableCell className="text-right px-2 text-xs">
                          {agg.customerSatisfactionScore !== null 
                            ? `${(agg.customerSatisfactionScore * 20).toFixed(1)}%`
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {providerAggregates.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        <Button
                          variant="ghost"
                          onClick={() => setShowAllRows(!showAllRows)}
                          className="flex items-center gap-2 mx-auto"
                        >
                          {showAllRows ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              Show Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Show All ({providerAggregates.length} total)
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}