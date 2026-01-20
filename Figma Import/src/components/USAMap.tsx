import React, { useState, useEffect, useMemo } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { StrategicInsights } from "./StrategicInsights";
import { geoPath, geoAlbersUsa } from "d3-geo";
import { feature } from "topojson-client";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Maximize2, TrendingUp, AlertTriangle, DollarSign } from "lucide-react";
import { BucketAssignment, calculateDefensiveValue } from "../utils/scoreCalculation";
import { GlobalFilters } from "../types";
import { applyGlobalFilters } from "../utils/applyGlobalFilters";
import { fetchFilterBuckets, fetchMSADetails as fetchMSADetailsFromCSV } from "../utils/csvDataHooks";

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
  Provider_Opportunity_Rank: number;
  Overall_Opportunity_Rank: number;
  Included_In_Ranking?: boolean;
  Exclusion?: boolean;
}

interface USAMapProps {
  mapData: MSAData[];
  globalFilters: GlobalFilters;
  bucketAssignments: BucketAssignment[];
  selectedMSAs?: Set<string>;
  onToggleSelection?: (msa: string) => void;
}

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

export function USAMap({ mapData, globalFilters, bucketAssignments, selectedMSAs, onToggleSelection }: USAMapProps) {
  const [hoveredMSA, setHoveredMSA] = useState<string | null>(null);
  const [selectedMSA, setSelectedMSA] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{data: MSAData, x: number, y: number} | null>(null);
  const [hoveredMSAProviders, setHoveredMSAProviders] = useState<OpportunityData[] | null>(null);
  const [isLoadingHoverDetails, setIsLoadingHoverDetails] = useState(false);
  const [msaDetails, setMsaDetails] = useState<{
    attractiveness: MSAData[];
    opportunities: OpportunityData[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [usaGeoJson, setUsaGeoJson] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterBuckets, setFilterBuckets] = useState<{
    marketSize?: { range: { min: number; max: number } };
    revenuePerCompany?: { range: { min: number; max: number } };
  }>({});

  // Fetch filter buckets to properly apply filters
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

  // Apply global filters to determine which MSAs should be shown
  const filteredMapData = useMemo(() => {
    return applyGlobalFilters(mapData, globalFilters, bucketAssignments, filterBuckets);
  }, [mapData, globalFilters, bucketAssignments, filterBuckets]);
  
  const filteredMSANames = useMemo(() => {
    return new Set(filteredMapData.map(msa => msa.MSA));
  }, [filteredMapData]);

  useEffect(() => {
    let isMounted = true;
    if (hoveredMSA) {
      setIsLoadingHoverDetails(true);
      fetchMSADetailsFromCSV(hoveredMSA).then(data => {
        if (isMounted && data.opportunities) {
            const sorted = [...data.opportunities].sort((a: any, b: any) => {
                 const shareA = parseFloat(String(a["Market Share"] || 0));
                 const shareB = parseFloat(String(b["Market Share"] || 0));
                 return shareB - shareA;
             });
             setHoveredMSAProviders(sorted.slice(0, 5));
        }
        if (isMounted) setIsLoadingHoverDetails(false);
      }).catch(() => {
        if (isMounted) setIsLoadingHoverDetails(false);
      });
    } else {
      setHoveredMSAProviders(null);
    }
    return () => { isMounted = false; };
  }, [hoveredMSA]);

  useEffect(() => {
    // Fetch USA TopoJSON data
    fetch(geoUrl)
      .then(response => response.json())
      .then(topology => {
        const states = feature(topology, topology.objects.states);
        setUsaGeoJson(states);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedMSA) {
      fetchMSADetails(selectedMSA);
      setIsDialogOpen(true);
    }
  }, [selectedMSA]);

  const fetchMSADetails = async (msaName: string) => {
    console.log(`USAMap: Fetching details for MSA: "${msaName}"`);
    setIsLoadingDetails(true);
    try {
      // Get attractiveness data from the already-calculated mapData (with correct categories)
      const attractivenessData = mapData.filter(item => item.MSA === msaName);
      console.log(`USAMap: Found ${attractivenessData.length} attractiveness records for ${msaName}`);
      
      // Fetch opportunities from CSV data
      const serverData = await fetchMSADetailsFromCSV(msaName);
      const opportunities = serverData.opportunities || [];
      
      console.log(`USAMap: Fetched ${opportunities.length} raw opportunities for ${msaName}`);
      console.log('USAMap: Sample opportunities:', opportunities.slice(0, 3).map(opp => ({
        Provider: opp.Provider,
        MarketShare: opp["Market Share"],
        ExclusionFlag: opp.Exclusion,
        IncludedInRanking: opp.Included_In_Ranking,
        OpportunityCategory: opp.Opportunity_Category
      })));
      
      // Store ALL opportunities (no filters) - filters will be applied per tab
      // Sort opportunities purely by Defend $ for true ranking by opportunity value
      const sortedOpportunities = [...opportunities]
        .sort((a: any, b: any) => {
          const defendA = typeof a["Defend $"] === 'string' ? parseFloat(a["Defend $"]) : a["Defend $"];
          const defendB = typeof b["Defend $"] === 'string' ? parseFloat(b["Defend $"]) : b["Defend $"];
          return (defendB || 0) - (defendA || 0);
        });
      
      console.log(`USAMap: After sorting (NO FILTERS), have ${sortedOpportunities.length} opportunities`);
      const truistData = sortedOpportunities.filter(opp => opp.Provider && opp.Provider.toLowerCase().includes('truist'));
      console.log('USAMap: Truist opportunities (ALL, no filters):', truistData.map(opp => ({
        Provider: opp.Provider,
        MarketShare: opp["Market Share"],
        MarketSharePercent: (parseFloat(String(opp["Market Share"] || 0)) * 100).toFixed(1) + '%',
        HasCategory: !!opp.Opportunity_Category,
        Exclusion: opp.Exclusion,
        IncludedInRanking: opp.Included_In_Ranking
      })));
      
      // Combine local attractiveness data with sorted opportunities
      setMsaDetails({
        attractiveness: attractivenessData,
        opportunities: sortedOpportunities
      });
    } catch (error) {
      // If server fetch fails, still show attractiveness data from local calculation
      const attractivenessData = mapData.filter(item => item.MSA === msaName);
      setMsaDetails({
        attractiveness: attractivenessData,
        opportunities: []
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getColorByCategory = (category: string) => {
    switch (category) {
      case "Highly Attractive":
        return "#22C55E";
      case "Attractive":
        return "#F59E0B";
      case "Neutral":
        return "#F97316";
      case "Challenging":
        return "#EF4444";
      default:
        return "#9CA3AF";
    }
  };

  const getBadgeColorByCategory = (category: string) => {
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

  const getScoreColor = (score: string) => {
    const s = score?.toLowerCase() || "";
    if (s === "high" || s === "rational" || s === "premium" || s.includes("below")) return "text-green-600 font-medium";
    if (s === "medium" || s === "par" || s.includes("at national")) return "text-yellow-600 font-medium";
    if (s === "low" || s === "irrational" || s === "discount" || s.includes("above")) return "text-red-600 font-medium";
    return "text-muted-foreground";
  };
  
  const getInverseScoreColor = (score: string) => {
    const s = score?.toLowerCase() || "";
    if (s === "low") return "text-green-600 font-medium";
    if (s === "medium") return "text-yellow-600 font-medium";
    if (s === "high") return "text-red-600 font-medium";
    return "text-muted-foreground";
  };

  const getRiskMigrationColor = (score: string) => {
     const s = score?.toLowerCase() || "";
     if (s === "low") return "text-green-600 font-medium";
     if (s === "medium") return "text-yellow-600 font-medium";
     if (s === "high") return "text-red-600 font-medium";
     return "text-muted-foreground";
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return "$0.00";
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatLargeMoney = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) {
      return "$0";
    }
    // Round up and remove decimals
    if (value >= 1e9) {
      return `$${Math.ceil(value / 1e9)}B`;
    } else if (value >= 1e6) {
      return `$${Math.ceil(value / 1e6)}M`;
    } else if (value >= 1e3) {
      return `$${Math.ceil(value / 1e3)}K`;
    }
    return `$${Math.ceil(value)}`;
  };

  const getOpportunityBadgeColor = (category: string) => {
    switch (category) {
      case "Excellent":
        return "bg-green-100 text-green-800 border-green-300";
      case "Good":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Fair":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // Group MSAs by name and get the primary attractiveness category
  const msaGroups = mapData.reduce((acc, item) => {
    if (!acc[item.MSA]) {
      acc[item.MSA] = [];
    }
    acc[item.MSA].push(item);
    return acc;
  }, {} as Record<string, MSAData[]>);

  // Get unique MSAs with their primary attractiveness (use the highest category)
  const uniqueMSAs = Object.entries(msaGroups).map(([msaName, msas]) => {
    const categorySortOrder = { "Highly Attractive": 0, Attractive: 1, Neutral: 2, Challenging: 3 };
    const primaryMSA = msas.sort(
      (a, b) =>
        categorySortOrder[a.Attractiveness_Category as keyof typeof categorySortOrder] -
        categorySortOrder[b.Attractiveness_Category as keyof typeof categorySortOrder]
    )[0];
    return primaryMSA;
  }).filter(msa => msa.LAT != null && msa.LON != null && !isNaN(msa.LAT) && !isNaN(msa.LON));

  // Identify strategic MSAs from filtered data
  const topMarket = filteredMapData.length > 0 ? filteredMapData.reduce((prev, current) => {
    return (current.Attractiveness_Score > prev.Attractiveness_Score) ? current : prev;
  }, filteredMapData[0]) : null;

  // Helper function to get strategic icon for an MSA
  const getStrategicIcon = (msaName: string) => {
    if (topMarket?.MSA === msaName) return "crown";
    return null;
  };

  // D3 Albers USA projection (standard for USA maps)
  const width = 960;
  const height = 600;
  const projection = geoAlbersUsa().scale(1280).translate([width / 2, height / 2]);
  const pathGenerator = geoPath().projection(projection);

  // Project lat/lon to map coordinates using D3
  const projectToMap = (lat: number, lon: number) => {
    const coords = projection([lon, lat]);
    if (coords) {
      return { x: coords[0], y: coords[1] };
    }
    return { x: 0, y: 0 };
  };

  // Calculate state centroids from GeoJSON
  const stateLabels = usaGeoJson?.features.map((feature: any) => {
    const centroid = pathGenerator.centroid(feature);
    return {
      abbr: feature.properties?.name || "",
      x: centroid[0],
      y: centroid[1]
    };
  }).filter((label: any) => !isNaN(label.x) && !isNaN(label.y)) || [];

  // State abbreviation mapping
  const stateNameToAbbr: Record<string, string> = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
    "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
    "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
    "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
    "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
  };

  // Add abbreviations to state labels
  const stateLabelsWithAbbr = stateLabels.map((label: any) => ({
    ...label,
    abbr: stateNameToAbbr[label.abbr] || label.abbr
  }));

  return (
    <>
      {/* MSA Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setSelectedMSA(null);
          setMsaDetails(null);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedMSA}</DialogTitle>
            <DialogDescription>
              View detailed market attractiveness data and opportunities for this MSA
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : msaDetails ? (
            <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">MSA Details</TabsTrigger>
                <TabsTrigger value="opportunities">
                  Acquisition Opportunities ({msaDetails.opportunities.filter(opp => opp.Included_In_Ranking === true && !opp.Exclusion && opp.Opportunity_Category).length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="flex-1 overflow-y-auto mt-4">
                <div className="space-y-4">
                  {msaDetails.attractiveness.map((attr, idx) => (
                    <Card key={idx} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={getBadgeColorByCategory(attr.Attractiveness_Category)}
                          >
                            {attr.Attractiveness_Category}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Score</span>
                            <p className="font-medium">{attr.Attractiveness_Score?.toFixed(2) || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Risk</span>
                            <p className="font-medium">{attr.Risk?.toFixed(1) || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Market Size</span>
                            <p className="font-medium">{formatCurrency(attr["Market Size"])}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">SOFR Plus</span>
                            <p className="font-medium">{attr.Price?.toFixed(0) || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Market Size Score</span>
                            <p className="font-medium">{attr.Market_Size_Score || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Growth Score</span>
                            <p className="font-medium">{attr.Economic_Growth_Score || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-muted-foreground text-xs">Market Concentration</span>
                            <p className="font-medium text-xs">
                              {attr.HHI_Score === "High" ? "Highly Concentrated" : 
                               attr.HHI_Score === "Medium" ? "Moderately Concentrated" : 
                               attr.HHI_Score === "Low" ? "Competitive" : "N/A"}
                            </p>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <span className="text-muted-foreground text-xs">Loan Pricing Rationality</span>
                            <div className="space-y-1">
                              <p className="font-medium">{attr.Pricing_Rationality || "N/A"}</p>
                              {attr.Pricing_Rationality_Explanation && (
                                <p className="text-xs text-muted-foreground italic">
                                  {attr.Pricing_Rationality_Explanation}
                                </p>
                              )}
                            </div>
                          </div>
                          {attr.Driving_Metric && (
                            <div className="space-y-1 col-span-2">
                              <span className="text-muted-foreground text-xs">Driving Metrics</span>
                              <p className="text-xs">{attr.Driving_Metric}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  {/* Top 5 Providers by Market Share */}
                  {/* Note: No filters applied - shows all opportunities regardless of Exclusion or Included_In_Ranking */}
                  {msaDetails.opportunities.length > 0 && (
                    <Card className="p-4">
                      <div className="space-y-3">
                        <h3 className="font-medium">Top 5 Providers by Market Share</h3>
                        <div className="space-y-2">
                          {msaDetails.opportunities
                            .sort((a, b) => parseFloat(String(b["Market Share"] || 0)) - parseFloat(String(a["Market Share"] || 0)))
                            .slice(0, 5)
                            .map((opp, idx) => (
                              <div key={idx} className="flex items-center justify-between py-2 border-b last:border-b-0">
                                <div className="flex items-center gap-3">
                                  <span className="text-muted-foreground text-sm w-4">{idx + 1}.</span>
                                  <span className="font-medium text-sm">{opp.Provider}</span>
                                </div>
                                <span className="font-medium text-sm">
                                  {(parseFloat(String(opp["Market Share"] || 0)) * 100).toFixed(1)}%
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="opportunities" className="flex-1 overflow-y-auto mt-4">
                {(() => {
                  // Filter to only show opportunities with Included_In_Ranking = true AND not excluded AND has category
                  const franchiseOpportunities = msaDetails.opportunities.filter(opp => 
                    opp.Included_In_Ranking === true && !opp.Exclusion && opp.Opportunity_Category
                  );
                  
                  return franchiseOpportunities.length > 0 ? (
                    <div className="space-y-2">
                      {franchiseOpportunities.map((opp, idx) => {
                        return (
                        <Card key={idx} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium">{opp.Provider}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="space-y-0.5">
                                <span className="text-muted-foreground">Market Share</span>
                                <p className="font-medium">{(parseFloat(String(opp["Market Share"] || 0)) * 100).toFixed(1)}%</p>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-muted-foreground">Rank</span>
                                <p className="font-medium">#{idx + 1}</p>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-muted-foreground">Market Share at Risk</span>
                                <p className="font-medium">
                                  {(() => {
                                    const marketShare = parseFloat(String(opp["Market Share"] || 0));
                                    const marketSize = parseFloat(String(opp["Market Size"] || 0));
                                    const defendDollars = parseFloat(String(opp["Defend $"] || 0));
                                    const providerMarketShareDollars = marketShare * marketSize;
                                    
                                    if (providerMarketShareDollars === 0) {
                                      return "0.0%";
                                    }
                                    
                                    const percentageAtRisk = (defendDollars / providerMarketShareDollars) * 100;
                                    if (percentageAtRisk < 5) return "<5%";
                                    if (percentageAtRisk > 25) return ">25%";
                                    return `${percentageAtRisk.toFixed(1)}%`;
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No competitive landscape data available for this MSA
                    </p>
                  );
                })()}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* USA Map */}
      <div className="w-full">
        <Card className="p-6 bg-white">
          <div className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3>Market Attractiveness Map</h3>
                {filteredMapData.length < mapData.length && (
                  <div className="text-xs text-muted-foreground bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    Showing {filteredMSANames.size} of {new Set(mapData.map(m => m.MSA)).size} MSAs
                  </div>
                )}
              </div>
              
              {/* Combined Legend */}
              <div className="flex gap-6 text-xs text-muted-foreground bg-slate-50 px-4 py-2 rounded-lg border">
                {/* Attractiveness Categories */}
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: "#22C55E" }}></div>
                  <span>Highly Attractive</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: "#F59E0B" }}></div>
                  <span>Attractive</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: "#F97316" }}></div>
                  <span>Neutral</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: "#EF4444" }}></div>
                  <span>Challenging</span>
                </div>
                
                {/* Divider */}
                <div className="w-px bg-gray-300"></div>
                
                {/* Strategic Icons */}
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="-5 -5 10 10">
                    <path d="M-4,-4 L-4,2 L4,2 L4,-4 L2,-2 L0,-4 L-2,-2 Z" fill="#F59E0B" stroke="#D97706" strokeWidth="0.5" />
                    <circle cx="-3" cy="-3.5" r="0.8" fill="#F59E0B" />
                    <circle cx="0" cy="-4.5" r="0.8" fill="#F59E0B" />
                    <circle cx="3" cy="-3.5" r="0.8" fill="#F59E0B" />
                  </svg>
                  <span>Top Market</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg border border-gray-200 overflow-hidden relative" style={{ backgroundColor: '#FAFBFC' }}>
            {/* Strategic Insights Panel */}
            <div className="absolute top-4 left-4 z-10">
              <StrategicInsights mapData={filteredMapData} />
            </div>
            
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
              panning={{ disabled: false, velocityDisabled: true }}
              wheel={{ disabled: false }}
              doubleClick={{ disabled: false }}
              limitToBounds={false}
              centerZoomedOut={false}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Tooltip Overlay */}
                  {tooltipData && (
                    <div 
                      style={{
                        position: 'fixed',
                        left: tooltipData.x + 15, 
                        top: tooltipData.y - 15,
                        zIndex: 1000,
                        pointerEvents: 'none'
                      }}
                    >
                      <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-[300px] text-xs overflow-hidden">
                         <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                           <span className="font-bold text-sm text-gray-900">{tooltipData.data.MSA}</span>
                           <Badge className={`text-[10px] h-5 px-1.5 ${getBadgeColorByCategory(tooltipData.data.Attractiveness_Category)}`}>
                             {tooltipData.data.Attractiveness_Category}
                           </Badge>
                         </div>
                         
                         <div className="p-3 space-y-3">
                           {/* Market Metrics */}
                           <div className="space-y-1.5">
                             <div className="font-semibold text-gray-900 flex items-center gap-1.5 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">
                               <TrendingUp className="w-3 h-3 text-gray-500" /> Market Metrics
                             </div>
                             <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">Size:</span> 
                                 <span className="font-medium text-gray-900">{formatLargeMoney(tooltipData.data["Market Size"])}</span>
                               </div>
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">HHI:</span> 
                                 <span className={getInverseScoreColor(tooltipData.data.HHI_Score)}>{tooltipData.data.HHI_Score}</span>
                               </div>
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">Int'l CM:</span> 
                                 <span className={getScoreColor(tooltipData.data.International_CM_Score)}>{tooltipData.data.International_CM_Score}</span>
                               </div>
                             </div>
                           </div>

                           {/* Growth & Risk */}
                           <div className="space-y-1.5">
                             <div className="font-semibold text-gray-900 flex items-center gap-1.5 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">
                               <AlertTriangle className="w-3 h-3 text-gray-500" /> Growth & Risk
                             </div>
                             <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">Econ:</span> 
                                 <span className={getScoreColor(tooltipData.data.Economic_Growth_Score)}>{tooltipData.data.Economic_Growth_Score}</span>
                               </div>
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">Loan:</span> 
                                 <span className={getScoreColor(tooltipData.data.Loan_Growth_Score)}>{tooltipData.data.Loan_Growth_Score}</span>
                               </div>
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">Risk:</span> 
                                 <span className={getInverseScoreColor(tooltipData.data.Risk_Score)}>{tooltipData.data.Risk_Score}</span>
                               </div>
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">Migr:</span> 
                                 <span className={getRiskMigrationColor(tooltipData.data.Risk_Migration_Score)}>{tooltipData.data.Risk_Migration_Score}</span>
                               </div>
                             </div>
                           </div>

                           {/* Pricing & Other */}
                           <div className="space-y-1.5">
                             <div className="font-semibold text-gray-900 flex items-center gap-1.5 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">
                               <DollarSign className="w-3 h-3 text-gray-500" /> Pricing & Other
                             </div>
                             <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                               <div className="flex justify-between items-baseline col-span-2">
                                 <span className="text-gray-500">SOFR Plus:</span> 
                                 <div className="flex items-center gap-1.5">
                                   <span className="font-medium text-gray-900">{tooltipData.data.Price?.toFixed(0) || "N/A"}</span>
                                   <span className={`text-[10px] px-1 rounded bg-gray-100 ${getScoreColor(tooltipData.data.Premium_Discount_Score)}`}>
                                     {tooltipData.data.Premium_Discount_Score}
                                   </span>
                                 </div>
                               </div>
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">Pricing:</span> 
                                 <span className={getScoreColor(tooltipData.data.Pricing_Rationality_Score)}>{tooltipData.data.Pricing_Rationality}</span>
                               </div>
                               <div className="flex justify-between items-baseline">
                                 <span className="text-gray-500">Rev/Co:</span> 
                                 <span className={getScoreColor(tooltipData.data.Revenue_per_Company_Score)}>{tooltipData.data.Revenue_per_Company_Score}</span>
                               </div>
                             </div>
                           </div>
                           
                           {/* Top Providers */}
                           <div className="space-y-1.5">
                              <div className="font-semibold text-gray-900 flex items-center gap-1.5 text-xs uppercase tracking-wider border-b border-gray-100 pb-1">
                                <TrendingUp className="w-3 h-3 text-gray-500" /> Top 5 Providers
                              </div>
                              {isLoadingHoverDetails ? (
                                <div className="text-gray-400 italic text-[10px] py-1">Loading providers...</div>
                              ) : hoveredMSAProviders && hoveredMSAProviders.length > 0 ? (
                                <div className="space-y-1">
                                  {hoveredMSAProviders.map((opp, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[10px]">
                                      <span className="text-gray-600 truncate max-w-[180px]">{idx + 1}. {opp.Provider}</span>
                                      <span className="font-medium text-gray-900">{(parseFloat(String(opp["Market Share"] || 0)) * 100).toFixed(1)}%</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-gray-400 italic text-[10px] py-1">No provider data available</div>
                              )}
                           </div>
                         </div>
                      </div>
                    </div>
                  )}

                  {/* Zoom controls */}
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <button
                      onClick={() => zoomIn()}
                      className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => zoomOut()}
                      className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => resetTransform()}
                      className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                      title="Reset Zoom"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>

                  <TransformComponent
                    wrapperStyle={{ width: "100%", height: "600px" }}
                    contentStyle={{ width: "100%", height: "100%" }}
                  >
                    <svg 
                      width="100%" 
                      height="600" 
                      viewBox="0 0 960 600" 
                      preserveAspectRatio="xMidYMid meet"
                      className="rounded"
                    >
                      <defs>
                        <filter id="shadow">
                          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3"/>
                        </filter>
                      </defs>
                      
                      {/* Background */}
                      <rect width="960" height="600" fill="#FAFBFC"/>
                      
                      {/* USA Map using GeoJSON */}
                      {usaGeoJson && (
                        <g>
                          {usaGeoJson.features.map((feature: any, i: number) => (
                            <path
                              key={i}
                              d={pathGenerator(feature) || ""}
                              fill="#FFFFFF"
                              stroke="#D1D5DB"
                              strokeWidth="1"
                              opacity="1"
                            />
                          ))}
                        </g>
                      )}

                      {/* State labels */}
                      {stateLabelsWithAbbr.map((state: any, i: number) => (
                        <text
                          key={i}
                          x={state.x}
                          y={state.y}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="500"
                          fill="#9CA3AF"
                          opacity="0.7"
                          pointerEvents="none"
                        >
                          {state.abbr}
                        </text>
                      ))}

                      {/* MSA markers as location pins */}
                      {uniqueMSAs.filter(msa => filteredMSANames.has(msa.MSA)).map((msa, idx) => {
                        const { x, y } = projectToMap(msa.LAT, msa.LON);
                        const isHovered = hoveredMSA === msa.MSA;
                        const isSelected = selectedMSAs?.has(msa.MSA);
                        const color = getColorByCategory(msa.Attractiveness_Category);
                        const pinScale = isHovered ? 1.3 : isSelected ? 1.5 : 1;
                        const pinOpacity = isHovered ? 1 : isSelected ? 1 : 0.95;
                        
                        // Extract city name from MSA (e.g., "CA-Fresno" -> "Fresno")
                        const cityName = msa.MSA.includes('-') 
                          ? msa.MSA.split('-')[1].trim() 
                          : msa.MSA;

                        return (
                          <g key={idx}>
                            {/* Location pin marker */}
                            <g 
                              transform={`translate(${x}, ${y}) scale(${pinScale})`}
                              style={{ 
                                cursor: "pointer", 
                                transition: "all 0.2s ease-in-out",
                                transformOrigin: "0 0"
                              }}
                              filter={isHovered || isSelected ? "url(#shadow)" : "none"}
                              onMouseEnter={(e) => {
                                setHoveredMSA(msa.MSA);
                                setTooltipData({ data: msa, x: e.clientX, y: e.clientY });
                              }}
                              onMouseMove={(e) => {
                                setTooltipData({ data: msa, x: e.clientX, y: e.clientY });
                              }}
                              onMouseLeave={() => {
                                setHoveredMSA(null);
                                setTooltipData(null);
                              }}
                              onClick={() => {
                                if (onToggleSelection) {
                                  onToggleSelection(msa.MSA);
                                } else {
                                  setSelectedMSA(msa.MSA);
                                  setIsDialogOpen(true);
                                }
                              }}
                            >
                              {/* Pin shape */}
                              <path
                                d="M0,-12 C-4,-12 -7,-9 -7,-5 C-7,-2 0,5 0,5 C0,5 7,-2 7,-5 C7,-9 4,-12 0,-12 Z"
                                fill={color}
                                stroke={isSelected ? "#1e293b" : "white"}
                                strokeWidth={isSelected ? "2.5" : "1.5"}
                                opacity={pinOpacity}
                              />
                              {/* Pin center dot */}
                              <circle
                                cx="0"
                                cy="-6"
                                r="2.5"
                                fill="white"
                                opacity={0.9}
                              />
                            </g>
                            
                            {/* City name label */}
                            <text
                              x={x}
                              y={y + 15}
                              fontSize={isHovered ? "11" : "10"}
                              fontWeight={isHovered ? "600" : "500"}
                              fill={isHovered ? "#1F2937" : "#4B5563"}
                              opacity={isHovered ? 1 : 0.85}
                              pointerEvents="none"
                              textAnchor="middle"
                              style={{ 
                                transition: "all 0.2s ease-in-out"
                              }}
                            >
                              {cityName}
                            </text>

                            {/* Strategic Icon */}
                            {(() => {
                              const iconType = getStrategicIcon(msa.MSA);
                              if (!iconType) return null;

                              const iconX = x + 10;
                              const iconY = y - 6;

                              return (
                                <g transform={`translate(${iconX}, ${iconY})`}>
                                  {iconType === "crown" && (
                                    <>
                                      {/* Crown Icon */}
                                      <title>Top Market - Highest Attractiveness Score</title>
                                      <path
                                        d="M-4,-4 L-4,2 L4,2 L4,-4 L2,-2 L0,-4 L-2,-2 Z"
                                        fill="#F59E0B"
                                        stroke="#D97706"
                                        strokeWidth="0.5"
                                      />
                                      <circle cx="-3" cy="-3.5" r="0.8" fill="#F59E0B" />
                                      <circle cx="0" cy="-4.5" r="0.8" fill="#F59E0B" />
                                      <circle cx="3" cy="-3.5" r="0.8" fill="#F59E0B" />
                                    </>
                                  )}
                                </g>
                              );
                            })()}
                          </g>
                        );
                      })}
                    </svg>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>
        </Card>
      </div>
    </>
  );
}
