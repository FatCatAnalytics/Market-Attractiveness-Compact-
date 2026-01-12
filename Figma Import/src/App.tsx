import { useState, useEffect, useMemo } from "react";
import { SummaryCards } from "./components/SummaryCards";
import { USAMap } from "./components/USAMap";
import { WhatIfAnalysis } from "./components/WhatIfAnalysis";
import { MSAExplorer } from "./components/MSAExplorer";
import { TargetOpportunities } from "./components/TargetOpportunities";
import { AcquisitionAnalysis } from "./components/AcquisitionAnalysis";
import { OpportunitiesTable } from "./components/OpportunityTable";
import { FilterDrawer } from "./components/FilterDrawer";
import { LandingPage } from "./components/LandingPage";
import { Loader2, SlidersHorizontal, Home } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { DEFAULT_WEIGHTS, Weights, recalculateData, BucketAssignment, recalculateDataWithBuckets, DEFAULT_BUCKET_ASSIGNMENTS, calculateBucketModeScore } from "./utils/scoreCalculation";
import { SummaryData, MSAData, SelectedFranchise, GlobalFilters } from "./types";
import { csvDataService } from "./utils/csvDataService";

export const DEFAULT_GLOBAL_FILTERS: GlobalFilters = {
  marketSizeRange: [0, 0],
  revenuePerCompanyRange: [0, 0],
  selectedRegions: [],
  selectedIndustries: [],
};

export default function App() {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [mapData, setMapData] = useState<MSAData[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Module selection state
  const [selectedModule, setSelectedModule] = useState<"market-size" | "market-attractiveness" | null>(null);
  
  // Global weights state for What-If Analysis
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [bucketAssignments, setBucketAssignments] = useState<BucketAssignment[]>(DEFAULT_BUCKET_ASSIGNMENTS);
  const [bucketWeights, setBucketWeights] = useState({ high: 60, medium: 40 });

  // Global filter state
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>(DEFAULT_GLOBAL_FILTERS);

  // Proforma Acquisition Analysis state
  const [activeTab, setActiveTab] = useState("msa-explorer");
  const [selectedFranchises, setSelectedFranchises] = useState<SelectedFranchise[]>([]);
  const [allProviders, setAllProviders] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<SelectedFranchise[]>([]);
  const [depositData, setDepositData] = useState<Array<{ MSA: string; Provider: string; "Market Share": string | number }>>([]);

  // Selected providers state - tracks providers selected across all views for competitor analysis
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());

  // Filter drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Toggle provider selection
  const toggleProviderSelection = (provider: string) => {
    setSelectedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(provider)) {
        newSet.delete(provider);
      } else {
        newSet.add(provider);
      }
      return newSet;
    });
  };

  // Clear all provider selections
  const clearProviderSelections = () => {
    setSelectedProviders(new Set());
  };

  // Always recalculate data based on current bucket assignments
  // Original CSV scores are IGNORED - we calculate fresh scores every time
  const calculatedMapData = useMemo(() => {
    console.log('=== App.tsx calculatedMapData recalculation ===');
    console.log('App.tsx: mapData length:', mapData.length);
    console.log('App.tsx: bucketAssignments:', bucketAssignments);
    console.log('App.tsx: bucketWeights:', bucketWeights);
    
    // Debug: Check original CSV data first
    const charlotteOriginal = mapData.find(item => item.MSA.includes('Charlotte'));
    if (charlotteOriginal) {
      console.log('App.tsx: Charlotte ORIGINAL CSV score:', charlotteOriginal.Attractiveness_Score);
      console.log('App.tsx: Charlotte original parameters:', {
        HHI_Score: charlotteOriginal.HHI_Score,
        Economic_Growth_Score: charlotteOriginal.Economic_Growth_Score,
        Risk_Score: charlotteOriginal.Risk_Score
      });
    }
    
    // Force a manual calculation to verify - this should be 2.30 if correct
    if (charlotteOriginal) {
      const manualScore = calculateBucketModeScore(charlotteOriginal, bucketAssignments, bucketWeights);
      console.log('App.tsx: MANUAL Charlotte calculation with current params:', manualScore);
      console.log('App.tsx: This manual score should be 2.30 if calculation is correct');
      
      // Also test with DEFAULT params to see baseline
      const defaultScore = calculateBucketModeScore(charlotteOriginal, DEFAULT_BUCKET_ASSIGNMENTS, { high: 60, medium: 40 });
      console.log('App.tsx: Charlotte with DEFAULT_BUCKET_ASSIGNMENTS:', defaultScore);
    }
    
    const result = recalculateDataWithBuckets(mapData, bucketAssignments, bucketWeights);
    
    // Debug: Find Charlotte-Concord-Gastonia after calculation
    const charlotte = result.find(item => item.MSA.includes('Charlotte'));
    if (charlotte) {
      console.log('App.tsx: Charlotte FINAL score after recalculateDataWithBuckets:', charlotte.Attractiveness_Score);
    }
    
    console.log('=== End App.tsx calculation ===');
    return result;
  }, [mapData, bucketAssignments, bucketWeights]);

  // Reset global filters to default
  const resetGlobalFilters = () => {
    setGlobalFilters(DEFAULT_GLOBAL_FILTERS);
    setBucketAssignments(DEFAULT_BUCKET_ASSIGNMENTS);
  };

  useEffect(() => {
    fetchSummaryData();
    fetchMapData();
  }, []);

  const fetchSummaryData = async () => {
    setIsLoadingSummary(true);
    setError(null);
    try {
      console.log("Loading summary data from CSV files");
      const data = await csvDataService.getSummaryData();
      setSummaryData(data);
    } catch (error) {
      console.error("Error loading summary data:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load summary data";
      setError(`Error loading data: ${errorMessage}`);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const fetchMapData = async () => {
    setIsLoadingMap(true);
    setError(null);
    try {
      console.log("Loading map data from CSV files");
      const data = await csvDataService.getMapData();
      setMapData(data);
    } catch (error) {
      console.error("Error loading map data:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load map data";
      setError(`Error loading data: ${errorMessage}`);
    } finally {
      setIsLoadingMap(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
            <h2 className="text-destructive mb-2">Error Loading Dashboard</h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            {error.includes("Failed to load") && (
              <div className="bg-background/50 rounded p-4 mb-4 text-left">
                <p className="text-xs text-muted-foreground">
                  <strong>Possible causes:</strong>
                  <br />• The CSV files (attractivenes.csv and opportunity.csv) may not be accessible
                  <br />• Check the browser console for more details
                  <br />• Ensure the CSV files are in the project root directory
                  <br />• Verify the CSV files contain valid data
                </p>
              </div>
            )}
            <button
              onClick={() => {
                setError(null);
                fetchSummaryData();
                fetchMapData();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show landing page if no module is selected
  if (!selectedModule) {
    return <LandingPage onSelectModule={setSelectedModule} />;
  }

  // Show Market Size & Share Tool (placeholder for now)
  if (selectedModule === "market-size") {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-[1800px] mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1>Market Size & Share Tool</h1>
              <p className="text-muted-foreground text-sm">
                Coming soon - Comprehensive market sizing and competitive analysis
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setSelectedModule(null)}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show Market Attractiveness Tool (existing app)
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1800px] mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1>Market Attractiveness Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Analyze metropolitan statistical areas by market attractiveness and identify strategic opportunities
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedModule(null)}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
            <div className="flex items-center justify-center w-48 h-16 border-2 border-dashed border-border rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Logo</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <div className="flex items-center gap-4">
            <TabsList className="grid w-full grid-cols-3 lg:w-[800px]">
              <TabsTrigger value="msa-explorer">Analyse a Market</TabsTrigger>
              <TabsTrigger value="opportunities">Analyse a Bank</TabsTrigger>
              <TabsTrigger value="acquisition">Proforma Acquisition Analysis</TabsTrigger>
            </TabsList>
            
            {/* Floating Filter Button - Show on all analysis tabs */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFilterDrawerOpen(true)}
              className="flex items-center gap-2 whitespace-nowrap ml-auto"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters & Preferences
            </Button>
          </div>

          {/* Analyse a Market Tab */}
          <TabsContent value="msa-explorer">
            {isLoadingMap ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MSAExplorer 
                data={calculatedMapData}
                weights={weights}
                globalFilters={globalFilters}
                bucketAssignments={bucketAssignments}
                selectedProviders={selectedProviders}
                onToggleProviderSelection={toggleProviderSelection}
                onClearProviderSelections={clearProviderSelections}
                onNavigateToCompetitorAnalysis={() => setActiveTab("opportunities")}
              />
            )}
          </TabsContent>

          {/* Target Opportunities Tab */}
          <TabsContent value="opportunities">
            {isLoadingMap ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TargetOpportunities 
                attractivenessData={calculatedMapData}
                onAnalyzeSelected={(franchises, providers, market, deposits) => {
                  setSelectedFranchises(franchises);
                  setAllProviders(providers);
                  setMarketData(market);
                  setDepositData(deposits);
                  setActiveTab("acquisition");
                }}
                globalFilters={globalFilters}
                bucketAssignments={bucketAssignments}
                preselectedProviders={selectedProviders}
              />
            )}
          </TabsContent>

          {/* Proforma Acquisition Analysis Tab */}
          <TabsContent value="acquisition">
            <AcquisitionAnalysis
              selectedFranchises={selectedFranchises}
              allProviders={allProviders}
              marketData={marketData}
              depositData={depositData}
              onBack={() => setActiveTab("opportunities")}
            />
          </TabsContent>
        </Tabs>

        {/* Filter Drawer - Accessible from both Analyse a Market and Analyse a Competitor */}
        <FilterDrawer
          isOpen={isFilterDrawerOpen}
          onOpenChange={setIsFilterDrawerOpen}
          data={calculatedMapData}
          weights={weights}
          setWeights={setWeights}
          bucketAssignments={bucketAssignments}
          setBucketAssignments={setBucketAssignments}
          bucketWeights={bucketWeights}
          setBucketWeights={setBucketWeights}
          globalFilters={globalFilters}
          setGlobalFilters={setGlobalFilters}
          resetGlobalFilters={resetGlobalFilters}
        />
      </div>
    </div>
  );
}